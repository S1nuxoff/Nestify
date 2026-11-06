from types import SimpleNamespace

import httpx
import json
import pytest
from fastapi import FastAPI, HTTPException
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


def add_plugin(client, plugin_id, kinds):
    store = client.app.dependency_overrides[api.get_store]()
    store.items[plugin_id] = plugin(plugin_id)
    store.items[plugin_id].manifest = {"kinds": kinds}
    return store


def test_torrents_plugin_replaces_the_built_in_row(client):
    add_plugin(client, "torrents", ["torrent"])
    items = client.get("/api/v4/extensions").json()["items"]
    row = [i for i in items if i["id"] == "torrents"]
    assert len(row) == 1 and row[0]["state"] == "installed" and "торрент" in row[0]["description"]


def kinds_plugins(client):
    store = client.app.dependency_overrides[api.get_store]()
    store.items.clear()
    add_plugin(client, "fast", ["direct"])
    add_plugin(client, "slow", ["torrent", "embed"])


def asked(client, kinds):
    data = client.post("/api/v4/sources", json={**QUERY, "kinds": kinds}).json()
    return {s["plugin_id"] for s in data["sources"]}, data["providers"]


def test_a_fast_start_does_not_ask_slow_plugins(client):
    kinds_plugins(client)
    # The fake plugin answers with kind "direct" whatever it is asked.
    assert asked(client, ["direct", "hls"]) == ({"fast"}, 1)


def test_results_of_other_kinds_are_dropped(client):
    kinds_plugins(client)
    assert asked(client, ["torrent", "embed"]) == (set(), 1)


def test_kinds_are_not_sent_to_plugins(client):
    seen = []

    def spy(request):
        seen.append(request.content)
        return source_host(request)

    http = httpx.AsyncClient(transport=httpx.MockTransport(spy))
    client.app.dependency_overrides[api.get_plugin_client] = lambda: PluginClient(http)
    kinds_plugins(client)
    client.post("/api/v4/sources", json={**QUERY, "kinds": ["direct"], "titles": {"en": "E"}})
    assert seen and b"kinds" not in seen[0] and b'"titles"' in seen[0]


def test_providers_counts_plugins_this_account_removed(client):
    kinds_plugins(client)
    client.put("/api/v4/extensions/slow", json={"installed": False})
    data = client.post("/api/v4/sources", json={**QUERY, "kinds": ["torrent"]}).json()
    assert (data["providers"], data["sources"], data["errors"]) == (1, [], [])


def test_extra_reaches_the_client(client):
    def with_extra(request):
        return httpx.Response(200, json={"sources": [{"id": "m", "title": "t", "kind": "torrent", "extra": {"magnet": "magnet:x"}}]})

    kinds_plugins(client)
    http = httpx.AsyncClient(transport=httpx.MockTransport(with_extra))
    client.app.dependency_overrides[api.get_plugin_client] = lambda: PluginClient(http)
    source = client.post("/api/v4/sources", json={**QUERY, "kinds": ["torrent"]}).json()["sources"][0]
    assert source["extra"] == {"magnet": "magnet:x"}


class SettingsPlugin:
    def __init__(self):
        self.saved = []

    def __call__(self, request):
        assert request.headers.get("authorization") in (None, "Bearer tok")
        if request.url.path.endswith("/settings"):
            if request.method == "PUT":
                body = json.loads(request.content)["values"]
                self.saved.append(body)
                if body.get("cookies") == "bad":
                    return httpx.Response(400, json={"detail": "Сайт не прийняв ці куки"})
            return httpx.Response(200, json={
                "status": {"ok": True, "message": "ok", "expires_at": 123},
                "fields": [{"key": "cookies", "label": "Куки"}],
                "help": [{"text": "step", "command": "ssh x"}],
            })
        return source_host(request)


@pytest.fixture
def settings_plugin(client):
    plugin_mock = SettingsPlugin()
    http = httpx.AsyncClient(transport=httpx.MockTransport(plugin_mock))
    client.app.dependency_overrides[api.get_plugin_client] = lambda: PluginClient(http)
    return plugin_mock


def test_status_is_only_for_admins(client, choices, settings_plugin):
    row = client.get("/api/v4/extensions").json()["items"][0]
    assert "status" not in row and "configurable" not in row
    choices.admin = True
    row = client.get("/api/v4/extensions").json()["items"][0]
    assert row["configurable"] is True and row["status"]["expires_at"] == 123


def test_plugin_without_settings_has_no_button(client, choices):
    def none(request):
        return httpx.Response(404)
    http = httpx.AsyncClient(transport=httpx.MockTransport(none))
    client.app.dependency_overrides[api.get_plugin_client] = lambda: PluginClient(http)
    choices.admin = True
    assert "configurable" not in client.get("/api/v4/extensions").json()["items"][0]


def test_settings_are_for_admins_only(client, settings_plugin):
    def deny():
        raise HTTPException(403)
    client.app.dependency_overrides[get_current_admin] = deny
    assert client.get("/api/v4/extensions/rezka/settings").status_code == 403
    assert client.put("/api/v4/extensions/rezka/settings", json={"values": {"cookies": "a=1"}}).status_code == 403
    assert settings_plugin.saved == []


def test_settings_reach_the_plugin(client, settings_plugin):
    data = client.get("/api/v4/extensions/rezka/settings").json()
    assert data["help"][0]["command"] == "ssh x"
    response = client.put("/api/v4/extensions/rezka/settings", json={"values": {"cookies": "a=1"}})
    assert response.status_code == 200 and settings_plugin.saved == [{"cookies": "a=1"}]


def test_plugin_explains_why_it_refused(client, settings_plugin):
    response = client.put("/api/v4/extensions/rezka/settings", json={"values": {"cookies": "bad"}})
    assert response.status_code == 400
    assert response.json()["detail"] == "Сайт не прийняв ці куки"


def test_settings_of_unknown_plugin(client, settings_plugin):
    assert client.get("/api/v4/extensions/none/settings").status_code == 404
    assert client.put("/api/v4/extensions/off/settings", json={"values": {}}).status_code == 404


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
