import asyncio
import logging
import os
import sys
from pathlib import Path

os.environ["PLUGIN_TOKEN"] = "secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import pytest
from fastapi.testclient import TestClient

import app as plugin
import domem
from search import Config, Searcher, parse_torznab, quality_label

AUTH = {"Authorization": "Bearer secret"}
QUERY = {"media_type": "movie", "title": "Початок", "original_title": "Inception", "year": 2010}
MAGNET = "magnet:?xt=urn:btih:"
TORZNAB_ITEM = """<item><title>{title}</title><size>1000</size><enclosure url="{magnet}"/>
<torznab:attr name="seeders" value="{seeders}"/><torznab:attr name="peers" value="2"/></item>"""
TORZNAB = """<rss xmlns:torznab="http://torznab.com/schemas/2015/feed"><channel>{items}</channel></rss>"""


def jacred_item(tracker, name, seeders=1, quality=1080):
    return {"title": name, "magnet": MAGNET + name, "size": 5, "sid": seeders, "pir": 1, "tracker": tracker,
            "voices": ["Дубляж", "LostFilm"], "quality": quality, "videotype": "sdr", "createTime": "2020"}


class Web:
    def __init__(self):
        self.requests = []
        self.jacred = [jacred_item("toloka", "ua"), jacred_item("rutor", "ru-low", 1), jacred_item("rutor", "ru-high", 9),
                       jacred_item("unknown", "dropped")]
        self.indexer = lambda indexer, query: TORZNAB.format(items=TORZNAB_ITEM.format(
            title=f"{indexer} release", magnet=f"{MAGNET}{indexer}", seeders=3))

    def __call__(self, request):
        self.requests.append(request)
        if "/api/v1.0/torrents" in request.url.path:
            return httpx.Response(200, json=self.jacred)
        indexer = request.url.path.split("/indexers/")[1].split("/")[0]
        return httpx.Response(200, text=self.indexer(indexer, request.url.params["q"]))


def config(**kw):
    c = Config()
    c.jackett_url, c.jackett_key, c.en_indexers = "https://jackett.test", "JACKETTKEY", ["yts"]
    c.pl_indexer, c.jacred_url, c.jacred_own_enabled = "polskie", "https://jacred.test", False
    c.en_enabled, c.pl_enabled, c.jacred_enabled = True, True, True
    for k, v in kw.items():
        setattr(c, k, v)
    return c


@pytest.fixture
def web():
    return Web()


@pytest.fixture
def embed():
    return {"value": None}


@pytest.fixture
def client(web, embed):
    async def fetch(imdb_id):
        return embed["value"] if imdb_id else None

    plugin.app.dependency_overrides[plugin.get_searcher] = lambda: Searcher(config(), httpx.MockTransport(web))
    plugin.app.dependency_overrides[plugin.get_embed_fetcher] = lambda: fetch
    yield TestClient(plugin.app, raise_server_exceptions=False)
    plugin.app.dependency_overrides.clear()


def sources(client, **extra):
    response = client.post("/sources", json={**QUERY, **extra}, headers=AUTH)
    assert response.status_code == 200, response.text
    return response.json()["sources"]


def test_auth(client):
    assert client.get("/health").status_code == 200
    assert client.get("/manifest.json").status_code == 401
    assert client.post("/sources", json=QUERY).status_code == 401
    assert client.post("/resolve", json={"source_id": "x"}).status_code == 401


def test_manifest(client):
    m = client.get("/manifest.json", headers=AUTH).json()
    assert (m["id"], m["api_version"], m["kinds"]) == ("torrents", 1, ["torrent", "embed"])


def test_languages_come_from_tracker_and_are_sorted_by_seeders(client):
    by = {}
    for s in sources(client, titles={"pl": "Incepcja"}):
        by.setdefault(s["language"], []).append(s["extra"]["magnet"].removeprefix(MAGNET))
    assert by == {"uk": ["ua"], "ru": ["ru-high", "ru-low"], "en": ["yts"], "pl": ["polskie"]}


def test_source_carries_everything_the_picker_shows(client):
    s = next(s for s in sources(client) if s["language"] == "uk")
    assert s["kind"] == "torrent" and s["id"] == MAGNET + "ua"
    assert (s["title"], s["quality"], s["seeders"], s["size_bytes"], s["voice"]) == ("ua", "1080p", 1, 5, "Дубляж")
    assert s["extra"]["voices"] == ["Дубляж", "LostFilm"]
    assert (s["extra"]["videotype"], s["extra"]["tracker"]) == ("sdr", "toloka")


def test_polish_is_only_searched_with_a_polish_title(client, web):
    assert not any(s["language"] == "pl" for s in sources(client))
    assert not any("polskie" in str(r.url) for r in web.requests)


def test_tv_also_searches_first_season(client, web):
    sources(client, media_type="tv")
    assert any(r.url.params.get("q") == "Inception S01" for r in web.requests)


def test_cyrillic_releases_are_not_english(client, web):
    web.indexer = lambda i, q: TORZNAB.format(items=TORZNAB_ITEM.format(title="Начало 2010", magnet=MAGNET + "x", seeders=1))
    assert not any(s["language"] == "en" for s in sources(client))


def test_same_torrent_is_listed_once(client, web):
    web.jacred = [jacred_item("rutor", "same"), jacred_item("rutor", "same")]
    assert [s["language"] for s in sources(client) if "same" in s["id"]] == ["ru"]


def test_failing_search_gives_the_rest(web, client):
    def broken(request):
        if "/indexers/" in request.url.path:
            raise httpx.ConnectError("https://jackett.test?apikey=JACKETTKEY")
        return web(request)
    plugin.app.dependency_overrides[plugin.get_searcher] = lambda: Searcher(config(), httpx.MockTransport(broken))
    assert {s["language"] for s in sources(client)} == {"uk", "ru"}


def test_jackett_key_stays_out_of_logs(web, client, caplog):
    def broken(request):
        if "/indexers/" in request.url.path:
            return httpx.Response(500)
        return web(request)
    plugin.app.dependency_overrides[plugin.get_searcher] = lambda: Searcher(config(), httpx.MockTransport(broken))
    with caplog.at_level(logging.INFO):
        sources(client)
    assert "JACKETTKEY" not in caplog.text
    assert logging.getLogger("httpx").level >= logging.WARNING


def test_key_is_not_in_results(client):
    assert all("JACKETTKEY" not in str(s) for s in sources(client))


def test_each_language_is_capped(client, web):
    web.jacred = [jacred_item("rutor", f"n{i}", i) for i in range(plugin.MAX_PER_LANGUAGE + 20)]
    ru = [s for s in sources(client) if s["language"] == "ru"]
    assert len(ru) == plugin.MAX_PER_LANGUAGE
    assert ru[0]["seeders"] == plugin.MAX_PER_LANGUAGE + 19


def test_long_magnet_keeps_a_valid_id_and_the_full_link(client, web):
    long_magnet = MAGNET + "abc" + "&tr=udp://tracker.example:80" * 200
    web.jacred = [{**jacred_item("rutor", "long"), "magnet": long_magnet}]
    s = next(s for s in sources(client) if s["language"] == "ru")
    assert len(s["id"]) <= 2048 and s["id"] == MAGNET + "abc"
    assert s["extra"]["magnet"] == long_magnet


def test_embed_is_a_source_with_its_data(client, embed):
    embed["value"] = {"imdb_id": "tt1", "embed_url": "https://api.domem.ws/embed/imdb/tt1", "title": "T", "hls": "h"}
    s = next(s for s in sources(client, imdb_id="tt1") if s["kind"] == "embed")
    assert s["id"] == "embed:tt1" and s["extra"]["embed"]["hls"] == "h"
    assert client.post("/resolve", json={"source_id": s["id"]}, headers=AUTH).json() == {
        "kind": "embed", "embed_url": "https://api.domem.ws/embed/imdb/tt1"}


def test_no_embed_without_imdb(client, embed):
    embed["value"] = {"imdb_id": "tt1", "embed_url": "u"}
    assert not any(s["kind"] == "embed" for s in sources(client))


def test_resolve(client, embed):
    assert client.post("/resolve", json={"source_id": MAGNET + "a"}, headers=AUTH).json() == {"kind": "torrent", "magnet": MAGNET + "a"}
    assert client.post("/resolve", json={"source_id": "embed:none"}, headers=AUTH).status_code == 404
    assert client.post("/resolve", json={"source_id": "http://x"}, headers=AUTH).status_code == 400


def test_quality_label():
    assert [quality_label(v) for v in (2160, 1080, 720, 480, 360, None, "x")] == ["4K", "1080p", "720p", "480p", None, None, None]


def test_torznab_magnet_can_be_in_link_and_broken_xml_is_empty():
    xml = TORZNAB.format(items=f"<item><title>t</title><link>{MAGNET}l</link></item><item><title>none</title></item>")
    assert [i["magnet"] for i in parse_torznab(xml)] == [MAGNET + "l"]
    assert parse_torznab("<broken") == []


def test_embed_parser_and_failures():
    html = '<title> Inception </title> id= 7, hls: "h.m3u8", dash: "d.mpd"'
    data = domem.parse_embed(html, "tt1", "u")
    assert (data["title"], data["embed_id"], data["hls"], data["dash"]) == ("Inception", 7, "h.m3u8", "d.mpd")
    assert domem.parse_embed("", "tt1", "u") is None

    down = httpx.MockTransport(lambda r: httpx.Response(500))
    assert asyncio.run(domem.fetch_embed("tt1", down)) is None
    assert asyncio.run(domem.fetch_embed("", down)) is None
