"""End-to-end tests of /api/v4 against fake plugins. Only the network and the database are faked."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.v1.endpoints.admin import get_current_admin
from app.api.v1.endpoints.auth import get_current_account
from app.api.v4 import plugins as api
from app.core.config import settings
from app.plugins.client import PluginClient, base_url_of, PluginError
from app.plugins.play import PlaySessions

MANIFEST = {"id": "rezka", "name": "HDRezka", "version": "1.0.0", "api_version": 1, "kinds": ["direct"]}
QUERY = {"media_type": "tv", "title": "Better Call Saul", "year": 2015, "season": 1, "episode": 1}
TOKEN = "plugin-secret"
SOURCE = {"id": "s1e1", "title": "LostFilm", "kind": "direct", "voice": "LostFilm"}
PROXIED = {
    "kind": "direct",
    "playback": "proxy",
    "streams": [{"quality": "1080p", "url": "https://cdn.test/v.mp4", "headers": {"Referer": "https://site.test"}}],
    "subtitles": [{"lang": "ru", "url": "https://cdn.test/ru.vtt"}],
}


class FakeStore:
    def __init__(self):
        self.items = {}

    async def list(self, enabled_only=False):
        return [p for p in self.items.values() if p.enabled or not enabled_only]

    async def get(self, plugin_id):
        return self.items.get(plugin_id)

    async def add(self, plugin):
        self.items[plugin.id] = SimpleNamespace(
            **{c: getattr(plugin, c) for c in
               ("id", "name", "version", "manifest_url", "base_url", "token", "enabled", "manifest")}
        )
        return self.items[plugin.id]

    async def update(self, plugin_id, **fields):
        plugin = self.items.get(plugin_id)
        if plugin:
            vars(plugin).update(fields)
        return plugin

    async def delete(self, plugin_id):
        return self.items.pop(plugin_id, None) is not None


class NoChoices:
    async def removed(self, account_id):
        return set()


class World:
    """Fake plugin hosts and a fake CDN."""

    def __init__(self):
        self.manifest = MANIFEST
        self.sources = {"sources": [SOURCE]}
        self.resolved = PROXIED
        self.seen = []
        self.media_seen = []

    def plugin(self, request: httpx.Request) -> httpx.Response:
        self.seen.append(request)
        host, path = request.url.host, request.url.path
        if host == "down.test":
            raise httpx.ConnectError("boom")
        if host == "broken.test" and path == "/sources":
            return httpx.Response(200, json={"sources": [{"id": "x"}]})
        if path == "/manifest.json":
            body = {**self.manifest, "id": "broken"} if host == "broken.test" else self.manifest
            return httpx.Response(200, json=body)
        if path == "/sources":
            return httpx.Response(200, json=self.sources)
        if path == "/resolve":
            return httpx.Response(200, json=self.resolved)
        return httpx.Response(404)

    def media(self, request: httpx.Request) -> httpx.Response:
        self.media_seen.append(request)
        if request.url.path == "/gone.mp4":
            return httpx.Response(404)
        if request.url.path == "/ru.vtt":
            return httpx.Response(200, stream=httpx.ByteStream(b"WEBVTT"), headers={"content-type": "application/octet-stream"})
        if request.headers.get("range"):
            return httpx.Response(206, stream=httpx.ByteStream(b"xy"), headers={
                "content-type": "video/mp4", "content-range": "bytes 0-1/100",
                "accept-ranges": "bytes", "content-length": "2", "x-secret": "no",
            })
        return httpx.Response(200, stream=httpx.ByteStream(b"video"), headers={"content-type": "video/mp4"})


@pytest.fixture
def world():
    return World()


@pytest.fixture
def store():
    return FakeStore()


@pytest.fixture
def sessions():
    return PlaySessions()


@pytest.fixture
def client(world, store, sessions, monkeypatch):
    monkeypatch.setattr(settings, "API_BASE_URL", "https://api.test/")
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v4")
    plugin_http = httpx.AsyncClient(transport=httpx.MockTransport(world.plugin))
    media_http = httpx.AsyncClient(transport=httpx.MockTransport(world.media))
    app.dependency_overrides.update({
        get_current_admin: lambda: SimpleNamespace(id=1),
        get_current_account: lambda: SimpleNamespace(id=2),
        api.get_store: lambda: store,
        api.get_plugin_client: lambda: PluginClient(plugin_http),
        api.get_media_http: lambda: media_http,
        api.get_sessions: lambda: sessions,
        api.get_account_plugins: lambda: NoChoices(),
    })
    return TestClient(app)


def install(client, url="https://plugin.test/manifest.json", token=TOKEN):
    return client.post("/api/v4/plugins", json={"manifest_url": url, "token": token})


def play_path(url):
    return url.removeprefix("https://api.test")


# --- install and manage ---------------------------------------------------------------------

def test_install_keeps_token_private_and_sends_it_to_plugin(client, world):
    response = install(client)
    assert response.status_code == 201
    assert response.json()["id"] == "rezka"
    assert response.json()["has_token"] is True
    assert TOKEN not in response.text
    assert TOKEN not in client.get("/api/v4/plugins").text
    assert world.seen[-1].headers["authorization"] == f"Bearer {TOKEN}"


def test_install_twice_conflicts(client):
    install(client)
    assert install(client).status_code == 409


@pytest.mark.parametrize("url", ["https://plugin.test/other.json", "file:///etc/manifest.json", "ftp://x/manifest.json"])
def test_install_rejects_bad_manifest_url(client, url, world):
    assert install(client, url=url).status_code == 400
    assert world.seen == []


@pytest.mark.parametrize("change", [{"api_version": 2}, {"id": "../evil"}, {"kinds": []}, {"kinds": ["ftp"]}])
def test_install_rejects_bad_manifest(client, world, store, change):
    world.manifest = {**MANIFEST, **change}
    assert install(client).status_code == 400
    assert store.items == {}


def test_disable_token_refresh_and_delete(client, store, world):
    install(client)
    assert client.patch("/api/v4/plugins/rezka", json={"enabled": False}).json()["enabled"] is False
    assert client.patch("/api/v4/plugins/rezka", json={"token": ""}).json()["has_token"] is False
    world.manifest = {**MANIFEST, "version": "2.0.0"}
    assert client.post("/api/v4/plugins/rezka/refresh").json()["version"] == "2.0.0"
    assert client.delete("/api/v4/plugins/rezka").status_code == 204
    assert client.delete("/api/v4/plugins/rezka").status_code == 404
    assert client.patch("/api/v4/plugins/rezka", json={"enabled": True}).status_code == 404


def test_refresh_refuses_identity_change(client, world):
    install(client)
    world.manifest = {**MANIFEST, "id": "other"}
    assert client.post("/api/v4/plugins/rezka/refresh").status_code == 409


# --- authorization --------------------------------------------------------------------------

def test_endpoints_require_auth(client):
    def deny():
        raise HTTPException(401)

    overrides = client.app.dependency_overrides
    overrides[get_current_admin] = deny
    overrides[get_current_account] = deny
    assert client.get("/api/v4/plugins").status_code == 401
    assert install(client).status_code == 401
    assert client.patch("/api/v4/plugins/x", json={}).status_code == 401
    assert client.post("/api/v4/plugins/x/refresh").status_code == 401
    assert client.delete("/api/v4/plugins/x").status_code == 401
    assert client.post("/api/v4/sources", json=QUERY).status_code == 401
    assert client.post("/api/v4/resolve", json={"plugin_id": "x", "source_id": "y"}).status_code == 401


# --- sources --------------------------------------------------------------------------------

def test_sources_tags_results_and_forwards_query(client, world):
    install(client)
    data = client.post("/api/v4/sources", json=QUERY).json()
    assert data["errors"] == []
    assert data["sources"] == [{
        **SOURCE, "plugin_id": "rezka", "plugin_name": "HDRezka",
        "quality": None, "language": None, "size_bytes": None, "seeders": None,
    }]
    assert json.loads(world.seen[-1].content) == QUERY


def test_sources_with_no_plugins(client):
    assert client.post("/api/v4/sources", json=QUERY).json() == {"sources": [], "errors": []}


def test_failing_plugins_do_not_hide_working_one(client, store, world):
    install(client)
    for pid, host in (("down", "down.test"), ("broken", "broken.test")):
        store.items[pid] = SimpleNamespace(
            id=pid, name=pid, version="1", manifest_url="", base_url=f"https://{host}",
            token=None, enabled=True, manifest={},
        )
    data = client.post("/api/v4/sources", json=QUERY).json()
    assert [s["plugin_id"] for s in data["sources"]] == ["rezka"]
    assert {e["plugin_id"] for e in data["errors"]} == {"down", "broken"}
    assert TOKEN not in json.dumps(data)


def test_disabled_plugin_is_not_called(client, world):
    install(client)
    client.patch("/api/v4/plugins/rezka", json={"enabled": False})
    world.seen.clear()
    assert client.post("/api/v4/sources", json=QUERY).json()["sources"] == []
    assert world.seen == []
    assert client.post("/api/v4/resolve", json={"plugin_id": "rezka", "source_id": "s"}).status_code == 404


# --- resolve --------------------------------------------------------------------------------

def resolve(client):
    return client.post("/api/v4/resolve", json={"plugin_id": "rezka", "source_id": "s1e1"})


def test_proxied_resolve_hides_upstream_url(client, world):
    install(client)
    response = resolve(client)
    assert json.loads(world.seen[-1].content) == {"source_id": "s1e1"}
    assert "cdn.test" not in response.text
    assert "Referer" not in response.text
    data = response.json()
    assert data["streams"][0]["quality"] == "1080p"
    assert data["streams"][0]["url"].startswith("https://api.test/api/v4/play/")
    assert data["subtitles"][0]["lang"] == "ru"


def test_direct_resolve_passes_url_through(client, world):
    install(client)
    world.resolved = {"kind": "hls", "streams": [{"quality": "auto", "url": "https://cdn.test/a.m3u8"}]}
    assert resolve(client).json()["streams"][0]["url"] == "https://cdn.test/a.m3u8"


@pytest.mark.parametrize("bad", [
    {"kind": "direct", "streams": []},
    {"kind": "direct", "streams": [{"quality": "q", "url": "file:///etc/passwd"}]},
    {"kind": "direct", "streams": [{"quality": "q", "url": "https://x", "headers": {"a": "b"}}]},
    {"kind": "hls", "playback": "proxy", "streams": [{"quality": "q", "url": "https://x"}]},
    {"kind": "torrent", "magnet": "https://not-a-magnet"},
    {"kind": "embed", "embed_url": "javascript:alert(1)"},
    {"kind": "embed"},
])
def test_resolve_rejects_protocol_violations(client, world, sessions, bad):
    install(client)
    world.resolved = bad
    assert resolve(client).status_code == 502
    assert len(sessions._items) == 0


def test_resolve_unknown_plugin(client):
    assert client.post("/api/v4/resolve", json={"plugin_id": "none", "source_id": "s"}).status_code == 404


# --- play -----------------------------------------------------------------------------------

def test_play_forwards_range_and_headers_without_auth(client, world):
    install(client)
    url = resolve(client).json()["streams"][0]["url"]
    client.app.dependency_overrides[get_current_account] = lambda: pytest.fail("play must not need auth")
    response = client.get(play_path(url), headers={"Range": "bytes=0-1"})
    assert response.status_code == 206
    assert response.content == b"xy"
    assert response.headers["content-range"] == "bytes 0-1/100"
    assert response.headers["accept-ranges"] == "bytes"
    assert "x-secret" not in response.headers
    assert world.media_seen[-1].headers["range"] == "bytes=0-1"
    assert world.media_seen[-1].headers["referer"] == "https://site.test"


def test_play_subtitles_get_vtt_type(client):
    install(client)
    url = resolve(client).json()["subtitles"][0]["url"]
    response = client.get(play_path(url))
    assert response.text == "WEBVTT"
    assert response.headers["content-type"].startswith("text/vtt")


def test_play_unknown_token(client):
    assert client.get("/api/v4/play/nope").status_code == 404


def test_play_upstream_error_is_hidden(client, sessions):
    token = sessions.create("https://cdn.test/gone.mp4")
    response = client.get(f"/api/v4/play/{token}")
    assert response.status_code == 502
    assert "cdn.test" not in response.text


def test_play_link_expires():
    sessions = PlaySessions(ttl=-1)
    assert sessions.get(sessions.create("https://x")) is None


def test_play_sessions_are_bounded():
    sessions = PlaySessions(limit=2)
    first = sessions.create("https://a")
    second = sessions.create("https://b")
    third = sessions.create("https://c")
    assert sessions.get(first) is None
    assert sessions.get(second) and sessions.get(third)


def test_play_streams_from_a_real_http_server(client, sessions):
    payload = bytes(range(256)) * 4096  # 1 MB

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            start, end = self.headers["Range"].removeprefix("bytes=").split("-")
            part = payload[int(start):int(end) + 1]
            self.send_response(206)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Length", str(len(part)))
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(payload)}")
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self.wfile.write(part)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    real_http = httpx.AsyncClient(follow_redirects=True)
    client.app.dependency_overrides[api.get_media_http] = lambda: real_http
    try:
        token = sessions.create(f"http://127.0.0.1:{server.server_port}/v.mp4")
        response = client.get(f"/api/v4/play/{token}", headers={"Range": "bytes=1000-500999"})
        assert response.status_code == 206
        assert response.content == payload[1000:501000]
        assert response.headers["content-length"] == "500000"
        assert response.headers["content-range"] == f"bytes 1000-500999/{len(payload)}"
    finally:
        server.shutdown()


class RedirectingCdn:
    def __init__(self):
        self.paths = []
        self.final_status = 206
        self.final_down = False

    def __call__(self, request):
        self.paths.append(request.url.path)
        if request.url.path == "/link.mp4":
            return httpx.Response(302, headers={"location": "https://edge.test/final.mp4"})
        if self.final_down:
            raise httpx.ConnectError("boom")
        if self.final_status != 206:
            return httpx.Response(self.final_status)
        return httpx.Response(206, stream=httpx.ByteStream(b"xy"), headers={"content-range": "bytes 0-1/2"})


@pytest.fixture
def cdn(client):
    cdn = RedirectingCdn()
    http = httpx.AsyncClient(transport=httpx.MockTransport(cdn), follow_redirects=True)
    client.app.dependency_overrides[api.get_media_http] = lambda: http
    return cdn


def seek(client, token, position=0):
    return client.get(f"/api/v4/play/{token}", headers={"Range": f"bytes={position}-"})


def test_seeks_skip_the_redirect(client, sessions, cdn):
    token = sessions.create("https://cdn.test/link.mp4")
    assert seek(client, token).status_code == 206
    assert cdn.paths == ["/link.mp4", "/final.mp4"]
    assert seek(client, token, 500).status_code == 206
    assert seek(client, token, 900).status_code == 206
    assert cdn.paths == ["/link.mp4", "/final.mp4", "/final.mp4", "/final.mp4"]


@pytest.mark.parametrize("status", [403, 404, 500])
def test_expired_final_link_goes_through_the_original_again(client, sessions, cdn, status):
    token = sessions.create("https://cdn.test/link.mp4")
    seek(client, token)
    cdn.final_status = status
    cdn.paths.clear()
    assert seek(client, token, 500).status_code == 502
    assert cdn.paths == ["/final.mp4", "/link.mp4", "/final.mp4"]
    assert sessions.get(token).final_url is None
    cdn.final_status = 206
    cdn.paths.clear()
    assert seek(client, token, 500).status_code == 206
    assert cdn.paths == ["/link.mp4", "/final.mp4"]
    assert sessions.get(token).final_url == "https://edge.test/final.mp4"


def test_unreachable_final_link_goes_through_the_original_again(client, sessions, cdn):
    token = sessions.create("https://cdn.test/link.mp4")
    seek(client, token)
    cdn.final_down = True
    cdn.paths.clear()
    assert seek(client, token, 500).status_code == 502
    assert cdn.paths == ["/final.mp4", "/link.mp4", "/final.mp4"]
    assert sessions.get(token).final_url is None


def test_seek_past_the_end_does_not_forget_the_final_link(client, sessions, cdn):
    token = sessions.create("https://cdn.test/link.mp4")
    seek(client, token)
    cdn.final_status = 416
    cdn.paths.clear()
    assert seek(client, token, 10**9).status_code == 416
    assert cdn.paths == ["/final.mp4"]
    assert sessions.get(token).final_url == "https://edge.test/final.mp4"


def test_link_without_redirect_keeps_working(client, sessions, world):
    token = sessions.create("https://cdn.test/v.mp4")
    assert seek(client, token).status_code == 206
    assert seek(client, token, 5).status_code == 206
    assert sessions.get(token).final_url is None


def test_final_link_stays_out_of_responses(client, sessions, cdn):
    token = sessions.create("https://cdn.test/link.mp4")
    response = seek(client, token)
    assert "edge.test" not in response.text
    assert "edge.test" not in str(response.headers)


# --- plugin client --------------------------------------------------------------------------

def test_base_url_of():
    assert base_url_of("https://p.test/a/manifest.json") == "https://p.test/a"
    with pytest.raises(PluginError):
        base_url_of("https://p.test/notmanifest.json")


@pytest.mark.anyio
async def test_client_does_not_follow_redirects_with_token():
    seen = []

    def handler(request):
        seen.append(request.url.host)
        return httpx.Response(302, headers={"location": "https://evil.test/manifest.json"})

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)
    with pytest.raises(PluginError):
        await PluginClient(http).manifest("https://p.test/manifest.json", "secret")
    assert seen == ["p.test"]


@pytest.mark.anyio
async def test_client_rejects_oversized_and_invalid_responses():
    big = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * (3 * 1024 * 1024))))
    with pytest.raises(PluginError, match="too large"):
        await PluginClient(big).manifest("https://p.test/manifest.json", None)
    junk = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"<html>")))
    with pytest.raises(PluginError, match="invalid JSON"):
        await PluginClient(junk).manifest("https://p.test/manifest.json", None)


@pytest.fixture
def anyio_backend():
    return "asyncio"
