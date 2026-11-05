from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints.auth import get_current_account
from app.api.v4 import playback as api
from app.models.playback_preference import PlaybackPreference
from app.models.users import User
from app.models.watch_history import WatchHistory
from app.plugins import playback as module
from app.plugins.playback import PlaybackStore
from app.services.media import watch_history

SAUL = "tmdb_tv_60059"
OTHER = "tmdb_tv_1"


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeStore:
    def __init__(self):
        self.saved = []

    async def owns(self, account_id, user_id):
        return account_id == 1 and user_id == 10

    async def state(self, user_id, movie_id):
        return {"title_voice": "LostFilm", "last_voice": None, "last_watch": None}

    async def save_voice(self, *args):
        self.saved.append(args)


@pytest.fixture
def store():
    return FakeStore()


@pytest.fixture
def client(store):
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v4")
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(id=1)
    app.dependency_overrides[api.get_playback_store] = lambda: store
    return TestClient(app)


def test_state_of_own_profile(client):
    response = client.get("/api/v4/playback", params={"user_id": 10, "movie_id": SAUL})
    assert response.status_code == 200
    assert response.json()["title_voice"] == "LostFilm"


def test_another_accounts_profile_is_refused(client, store):
    assert client.get("/api/v4/playback", params={"user_id": 11, "movie_id": SAUL}).status_code == 403
    body = {"user_id": 11, "movie_id": SAUL, "voice": "x"}
    assert client.put("/api/v4/playback/voice", json=body).status_code == 403
    assert store.saved == []


def test_save_voice_defaults_to_automatic(client, store):
    body = {"user_id": 10, "movie_id": SAUL, "voice": "Дубляж"}
    assert client.put("/api/v4/playback/voice", json=body).status_code == 204
    assert client.put("/api/v4/playback/voice", json={**body, "explicit": True}).status_code == 204
    assert store.saved == [(10, SAUL, "Дубляж", False), (10, SAUL, "Дубляж", True)]


def test_login_is_required():
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v4")
    client = TestClient(app)
    assert client.get("/api/v4/playback", params={"user_id": 10, "movie_id": SAUL}).status_code == 401
    assert client.put("/api/v4/playback/voice", json={"user_id": 10, "movie_id": SAUL, "voice": "x"}).status_code == 401


# --- real SQL ---------------------------------------------------------------------------------

@pytest.fixture
async def sql_store(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        for table in (PlaybackPreference.__table__, WatchHistory.__table__):
            await conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
            await conn.run_sync(lambda c, t=table: t.create(c, checkfirst=True))
    factory = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(module, "async_session", factory)
    monkeypatch.setattr(watch_history, "async_session", factory)
    yield PlaybackStore()
    await engine.dispose()


@pytest.mark.anyio
async def test_automatic_voice_stays_with_the_title(sql_store):
    await sql_store.save_voice(10, SAUL, "Амедиа", False)
    state = await sql_store.state(10, SAUL)
    assert (state["title_voice"], state["last_voice"]) == ("Амедиа", None)


@pytest.mark.anyio
async def test_chosen_voice_applies_to_new_titles_too(sql_store):
    await sql_store.save_voice(10, SAUL, "Амедиа", False)
    await sql_store.save_voice(10, SAUL, "LostFilm", True)
    assert (await sql_store.state(10, SAUL))["title_voice"] == "LostFilm"
    other = await sql_store.state(10, OTHER)
    assert (other["title_voice"], other["last_voice"]) == (None, "LostFilm")


@pytest.mark.anyio
async def test_profiles_do_not_share_voices(sql_store):
    await sql_store.save_voice(10, SAUL, "LostFilm", True)
    state = await sql_store.state(20, SAUL)
    assert (state["title_voice"], state["last_voice"], state["last_watch"]) == (None, None, None)


@pytest.mark.anyio
async def test_last_watch_is_the_most_recent_episode(sql_store):
    await watch_history.update_watch_position(10, SAUL, 100, season=1, episode=1, duration=3000)
    await watch_history.update_watch_position(10, SAUL, 200, season=1, episode=2, duration=3000)
    last = (await sql_store.state(10, SAUL))["last_watch"]
    assert last == {"season": 1, "episode": 2, "position_seconds": 200, "duration": 3000}
