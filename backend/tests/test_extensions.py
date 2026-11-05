from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.endpoints.admin import get_current_admin
from app.api.v1.endpoints.auth import get_current_account
from app.api.v4 import extensions, plugins as api
from app.models.account_plugin import AccountPlugin
from app.plugins import account_plugins as module
from app.plugins.account_plugins import AccountPluginStore
from app.plugins.client import PluginClient

QUERY = {"media_type": "movie", "title": "x"}


def plugin(plugin_id, enabled=True):
    return SimpleNamespace(id=plugin_id, name=plugin_id.title(), version="1", manifest_url="", enabled=enabled, token=None,
                           base_url=f"https://{plugin_id}.test", manifest={"description": "from manifest"})


class Plugins:
    def __init__(self, *items):
        self.items = {p.id: p for p in items}
    async def list(self, enabled_only=False):
        return [p for p in self.items.values() if p.enabled or not enabled_only]
    async def get(self, plugin_id):
        return self.items.get(plugin_id)


class Choices:
    def __init__(self):
        self.by_account = {}
        self.admin = False
    async def removed(self, account_id):
        return self.by_account.setdefault(account_id, set())
    async def set_installed(self, account_id, plugin_id, installed):
        removed = self.by_account.setdefault(account_id, set())
        (removed.discard if installed else removed.add)(plugin_id)
    async def is_admin(self, account_id):
        return self.admin


def source_host(request):
    if request.url.path == "/sources":
        return httpx.Response(200, json={"sources": [{"id": request.url.host, "title": "t", "kind": "direct"}]})
    return httpx.Response(200, json={"kind": "direct", "streams": [{"quality": "q", "url": "https://cdn/v.mp4"}]})


@pytest.fixture
def choices():
    return Choices()


@pytest.fixture
def client(choices):
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v4")
    app.include_router(extensions.router, prefix="/api/v4")
    store = Plugins(plugin("rezka"), plugin("other"), plugin("off", enabled=False))
    http = httpx.AsyncClient(transport=httpx.MockTransport(source_host))
    app.dependency_overrides.update({
        get_current_account: lambda: SimpleNamespace(id=1),
        get_current_admin: lambda: SimpleNamespace(id=1),
        api.get_store: lambda: store,
        api.get_account_plugins: lambda: choices,
        api.get_plugin_client: lambda: PluginClient(http),
    })
    return TestClient(app)


def states(client):
    return {i["id"]: i["state"] for i in client.get("/api/v4/extensions").json()["items"]}


def test_everything_is_installed_by_default(client):
    assert states(client) == {"rezka": "installed", "other": "installed", "torrents": "builtin", "subtitles": "soon"}


def test_page_text_comes_from_our_list_then_the_manifest(client):
    text = {i["id"]: i["description"] for i in client.get("/api/v4/extensions").json()["items"]}
    assert "HDRezka" in text["rezka"]
    assert text["other"] == "from manifest"


def test_no_secrets_or_addresses_on_the_page(client):
    assert ".test" not in client.get("/api/v4/extensions").text


def test_removed_plugin_is_not_asked_for_sources(client):
    assert client.put("/api/v4/extensions/rezka", json={"installed": False}).status_code == 204
    assert states(client)["rezka"] == "available"
    data = client.post("/api/v4/sources", json=QUERY).json()
    assert {s["plugin_id"] for s in data["sources"]} == {"other"}


def test_removed_plugin_cannot_be_played(client):
    body = {"plugin_id": "rezka", "source_id": "s"}
    assert client.post("/api/v4/resolve", json=body).status_code == 200
    client.put("/api/v4/extensions/rezka", json={"installed": False})
    assert client.post("/api/v4/resolve", json=body).status_code == 404


def test_installing_again_brings_it_back(client):
    client.put("/api/v4/extensions/rezka", json={"installed": False})
    client.put("/api/v4/extensions/rezka", json={"installed": True})
    assert states(client)["rezka"] == "installed"
    assert {s["plugin_id"] for s in client.post("/api/v4/sources", json=QUERY).json()["sources"]} == {"rezka", "other"}


def test_one_account_does_not_affect_another(client):
    client.put("/api/v4/extensions/rezka", json={"installed": False})
    client.app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(id=2)
    assert states(client)["rezka"] == "installed"
    assert "rezka" in {s["plugin_id"] for s in client.post("/api/v4/sources", json=QUERY).json()["sources"]}


@pytest.mark.parametrize("plugin_id", ["none", "off", "torrents"])
def test_only_running_plugins_can_be_changed(client, plugin_id):
    assert client.put(f"/api/v4/extensions/{plugin_id}", json={"installed": False}).status_code == 404


def test_admin_flag(client, choices):
    assert client.get("/api/v4/extensions").json()["is_admin"] is False
    choices.admin = True
    assert client.get("/api/v4/extensions").json()["is_admin"] is True


def test_login_is_required():
    app = FastAPI()
    app.include_router(extensions.router, prefix="/api/v4")
    client = TestClient(app)
    assert client.get("/api/v4/extensions").status_code == 401
    assert client.put("/api/v4/extensions/rezka", json={"installed": False}).status_code == 401


# --- real SQL ---------------------------------------------------------------------------------

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def sql_store(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: AccountPlugin.__table__.create(c, checkfirst=True))
    factory = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(module, "async_session", factory)
    yield AccountPluginStore()
    await engine.dispose()


@pytest.mark.anyio
async def test_store_remembers_per_account(sql_store):
    assert await sql_store.removed(1) == set()
    await sql_store.set_installed(1, "rezka", False)
    assert await sql_store.removed(1) == {"rezka"}
    assert await sql_store.removed(2) == set()
    await sql_store.set_installed(1, "rezka", True)
    assert await sql_store.removed(1) == set()
