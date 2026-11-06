"""Plugin behaviour against a fake site. Live checks against the real site are done on the server."""

import base64
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

os.environ["PLUGIN_TOKEN"] = "secret"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

import app as plugin
import rezka
from rezka import Blocked, Matcher, Site, TtlCache, normalize, slug_year

SAUL = "/series/drama/7769-luchshe-zvonite-solu-2015-latest.html"
JIMMY = "/cartoons/comedy/49237-luchshe-zvonite-solu-predstavlyaet-paduchiy-dzhimmi-2022-latest.html"
NACHALO_2010 = "/films/action/770-nachalo-2010.html"
NACHALO_2013 = "/films/action/8969-nachalo-2013.html"
AUTH = {"Authorization": "Bearer secret"}


class FakeStream:
    videos = {
        "720p": ["https://cdn/720.mp4"], "1080p": ["https://cdn/1080.mp4"], "480p": [],
        "1080p Ultra": ["https://cdn/stub.mp4"], "2K": ["https://cdn/stub.mp4"], "4K": ["https://cdn/stub.mp4"],
    }
    subtitles = SimpleNamespace(subtitles={"ru": {"title": "Русский", "link": "https://cdn/ru.vtt"}})


def tv_page(names, orig):
    return SimpleNamespace(
        type=SimpleNamespace(name="tv_series"), names=names, origNames=orig,
        seriesInfo={
            1: {"translator_name": "LostFilm", "episodes": {1: {1: "e", 2: "e"}, 6: {13: "e"}}},
            32: {"translator_name": "Jaskier", "episodes": {2: {1: "e"}}},
        },
        translators={1: {"name": "LostFilm"}},
        calls=[],
    )


def movie_page(names, orig):
    return SimpleNamespace(
        type=SimpleNamespace(name="movie"), names=names, origNames=orig,
        translators={56: {"name": "Дубляж"}}, seriesInfo={}, calls=[],
    )


class FakeSite:
    def __init__(self):
        self.blocked = False
        self.searches = []
        self.loaded = []
        self.results = {
            "Better Call Saul": [("Лучше звоните Солу", SAUL), ("Падучий Джимми", JIMMY)],
            "Краще подзвоніть Солу": [("Лучше звоните Солу", SAUL), ("Падучий Джимми", JIMMY)],
            "Начало": [("Начало", NACHALO_2013), ("Начало", NACHALO_2010)],
            "Inception": [("Начало", NACHALO_2010)],
        }
        self.pages = {
            SAUL: tv_page(["Лучше звоните Солу"], ["Better Call Saul"]),
            JIMMY: tv_page(["Падучий Джимми"], ["Slippin Jimmy"]),
            NACHALO_2010: movie_page(["Начало"], ["Inception"]),
            NACHALO_2013: movie_page(["Начало"], ["The Beginning"]),
        }
        for page in self.pages.values():
            page.getStream = lambda *a, page=page, **k: (page.calls.append((a, k)), FakeStream)[1]

    def search(self, query):
        self.searches.append(query)
        return [{"title": t, "url": f"https://rezka.ag{p}"} for t, p in self.results.get(query, [])]

    def page(self, path):
        self.loaded.append(path)
        if self.blocked:
            raise Blocked()
        return self.pages[path]

    def check_access(self):
        if self.blocked:
            raise Blocked()


@pytest.fixture
def site():
    return FakeSite()


@pytest.fixture
def client(site):
    plugin.app.dependency_overrides[plugin.get_matcher] = lambda: Matcher(site)
    yield TestClient(plugin.app, raise_server_exceptions=False)
    plugin.app.dependency_overrides.clear()


SAUL_QUERY = {"media_type": "tv", "title": "Краще подзвоніть Солу", "original_title": "Better Call Saul",
              "year": 2015, "season": 1, "episode": 1}


def voices(response):
    return [s["voice"] for s in response.json()["sources"]]


def test_auth_required_except_health(client):
    assert client.get("/health").status_code == 200
    assert client.get("/manifest.json").status_code == 401
    assert client.get("/manifest.json", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/status").status_code == 401
    assert client.post("/sources", json=SAUL_QUERY).status_code == 401
    assert client.post("/resolve", json={"source_id": "x"}).status_code == 401


def test_manifest_follows_protocol(client):
    data = client.get("/manifest.json", headers=AUTH).json()
    assert (data["id"], data["api_version"], data["kinds"]) == ("rezka", 1, ["direct"])


def test_episode_lists_only_voices_that_have_it(client):
    response = client.post("/sources", json=SAUL_QUERY, headers=AUTH)
    assert voices(response) == ["LostFilm"]
    assert response.json()["sources"][0]["id"] == f"{SAUL}|1|1|1"
    assert response.json()["sources"][0]["kind"] == "direct"
    assert voices(client.post("/sources", json={**SAUL_QUERY, "season": 2}, headers=AUTH)) == ["Jaskier"]
    assert voices(client.post("/sources", json={**SAUL_QUERY, "season": 9}, headers=AUTH)) == []


def test_tv_without_episode_returns_nothing(client, site):
    body = {k: v for k, v in SAUL_QUERY.items() if k != "episode"}
    assert voices(client.post("/sources", json=body, headers=AUTH)) == []
    assert site.searches == []


def test_movie_picked_by_original_name(client):
    body = {"media_type": "movie", "title": "Початок", "original_title": "Inception", "year": 2010}
    response = client.post("/sources", json=body, headers=AUTH)
    assert voices(response) == ["Дубляж"]
    assert response.json()["sources"][0]["id"] == f"{NACHALO_2010}|56||"


@pytest.mark.parametrize("year,expected", [(2010, NACHALO_2010), (2013, NACHALO_2013)])
def test_same_name_is_told_apart_by_year(client, year, expected):
    body = {"media_type": "movie", "title": "Начало", "year": year}
    assert client.post("/sources", json=body, headers=AUTH).json()["sources"][0]["id"].startswith(expected)


@pytest.mark.parametrize("body", [
    {"media_type": "movie", "title": "Inception", "year": 1999},                   # wrong year
    {"media_type": "tv", "title": "Inception", "year": 2010, "season": 1, "episode": 1},  # wrong type
    {"media_type": "movie", "title": "Начало", "original_title": "Другое", "year": 2020},
    {"media_type": "movie", "title": "Нет такого"},
])
def test_no_confident_match_returns_nothing(client, body):
    assert voices(client.post("/sources", json=body, headers=AUTH)) == []


def test_lookalike_title_is_rejected(client, site):
    site.results["Падучий"] = [("Падучий Джимми", JIMMY)]
    body = {"media_type": "tv", "title": "Падучий", "season": 1, "episode": 1}
    assert voices(client.post("/sources", json=body, headers=AUTH)) == []


def test_match_is_cached(site):
    matcher = Matcher(site)
    assert matcher.find("movie", "Inception", None, 2010) is matcher.find("movie", "Inception", None, 2010)
    assert site.searches == ["Inception"]
    assert site.loaded == [NACHALO_2010]


class FakeMap:
    def __init__(self, tmdb=None, imdb=None, broken=False):
        self.tmdb, self.imdb, self.broken = tmdb or {}, imdb or {}, broken
        self.saved = []

    def lookup(self, media_type, tmdb_id, imdb_id):
        if self.broken:
            raise OSError("db down")
        return self.tmdb.get((tmdb_id, media_type)) or self.imdb.get(imdb_id) or []

    def remember(self, *args):
        if self.broken:
            raise OSError("db down")
        self.saved.append(args)


def test_map_finds_title_without_searching_or_name_check(site):
    matcher = Matcher(site, FakeMap(tmdb={("60059", "tv"): [SAUL]}))
    page = matcher.find("tv", "Назва, якої нема на сайті", None, 2015, "60059")
    assert page._path == SAUL
    assert site.searches == []


def test_map_falls_back_to_imdb(site):
    matcher = Matcher(site, FakeMap(imdb={"tt1375666": [NACHALO_2010]}))
    assert matcher.find("movie", "x", None, None, "999", "tt1375666")._path == NACHALO_2010
    assert site.searches == []


def test_map_entry_of_wrong_type_is_ignored(site):
    matcher = Matcher(site, FakeMap(tmdb={("27205", "tv"): [NACHALO_2010]}))
    assert matcher.find("tv", "нет", None, None, "27205") is None


def test_shared_id_needs_name_and_year(site):
    mapping = FakeMap(tmdb={("1", "movie"): [NACHALO_2013, NACHALO_2010]})
    assert Matcher(site, mapping).find("movie", "Начало", None, 2010, "1")._path == NACHALO_2010
    assert Matcher(site, mapping).find("movie", "Other", None, 2010, "1") is None


def test_removed_mapped_page_falls_back_to_search(site):
    matcher = Matcher(site, FakeMap(tmdb={("27205", "movie"): ["/films/gone-2010.html"]}))
    assert matcher.find("movie", "Inception", None, 2010, "27205")._path == NACHALO_2010
    assert site.searches == ["Inception"]


def test_found_by_search_is_saved(site):
    mapping = FakeMap()
    Matcher(site, mapping).find("movie", "Inception", None, 2010, "27205", "tt1375666")
    assert mapping.saved == [(NACHALO_2010, "Начало", "movie", "27205", "tt1375666")]


def test_broken_database_does_not_break_search(site):
    matcher = Matcher(site, FakeMap(broken=True))
    assert matcher.find("movie", "Inception", None, 2010, "27205")._path == NACHALO_2010


def test_bot_check_on_mapped_page_is_reported(site):
    site.blocked = True
    with pytest.raises(Blocked):
        Matcher(site, FakeMap(tmdb={("60059", "tv"): [SAUL]})).find("tv", "x", None, None, "60059")


def test_sources_pass_ids_to_the_map(client, site):
    plugin.app.dependency_overrides[plugin.get_matcher] = lambda: Matcher(site, FakeMap(tmdb={("60059", "tv"): [SAUL]}))
    body = {"media_type": "tv", "title": "x", "tmdb_id": "60059", "season": 1, "episode": 1}
    assert voices(client.post("/sources", json=body, headers=AUTH)) == ["LostFilm"]


def test_match_survives_page_cache_expiry(site):
    matcher = Matcher(site)
    matcher.find("movie", "Inception", None, 2010)
    matcher.pages = TtlCache()
    assert matcher.find("movie", "Inception", None, 2010)._path == NACHALO_2010
    assert site.searches == ["Inception"]


def test_check_access_detects_bot_check(monkeypatch):
    responses = iter(["<title>Проверяем, что вы не бот!</title>", "<title>HDrezka</title>"])
    monkeypatch.setattr(rezka.requests, "get", lambda *a, **k: SimpleNamespace(
        text=next(responses), raise_for_status=lambda: None,
    ))
    site = Site("https://rezka.ag/", {}, {})
    with pytest.raises(Blocked):
        site.check_access()
    site.check_access()


def test_no_match_is_cached(site):
    matcher = Matcher(site)
    assert matcher.find("movie", "Нет такого", None, None) is None
    assert matcher.find("movie", "Нет такого", None, None) is None
    assert site.searches == ["Нет такого"]


def test_bot_check_is_an_error_not_an_empty_result(client, site):
    site.blocked = True
    site.results = {}
    response = client.post("/sources", json=SAUL_QUERY, headers=AUTH)
    assert response.status_code == 503
    assert client.get("/status", headers=AUTH).status_code == 503
    site.blocked = False
    assert client.get("/status", headers=AUTH).status_code == 200


def test_resolve_series(client, site):
    data = client.post("/resolve", json={"source_id": f"{SAUL}|1|6|13"}, headers=AUTH).json()
    assert site.pages[SAUL].calls == [(("6", "13"), {"translation": "1"})]
    assert data["playback"] == "proxy"
    assert data["streams"] == [
        {"quality": "720p", "url": "https://cdn/720.mp4"},
        {"quality": "1080p", "url": "https://cdn/1080.mp4"},
    ]
    assert data["subtitles"] == [{"lang": "ru", "label": "Русский", "url": "https://cdn/ru.vtt"}]


def test_resolve_movie(client, site):
    assert client.post("/resolve", json={"source_id": f"{NACHALO_2010}|56||"}, headers=AUTH).status_code == 200
    assert site.pages[NACHALO_2010].calls == [((), {"translation": "56"})]


@pytest.mark.parametrize("source_id", [
    "x", "https://evil.test/a.html|1||", "/a/../../b.html|1||", "/a.html|abc||", "//evil.test/a.html;|1||",
])
def test_resolve_rejects_foreign_ids(client, site, source_id):
    assert client.post("/resolve", json={"source_id": source_id}, headers=AUTH).status_code == 400
    assert site.loaded == []


def test_site_errors_do_not_leak_details(client, site):
    def boom(path):
        raise RuntimeError("cookie=SECRET")

    site.page = boom
    response = client.post("/resolve", json={"source_id": f"{SAUL}|1|1|1"}, headers=AUTH)
    assert response.status_code == 502
    assert "SECRET" not in response.text


def test_helpers():
    assert normalize("  Ёлки: Новый ГОД! ") == "елки новый год"
    assert slug_year(SAUL) == 2015
    assert slug_year(NACHALO_2010) == 2010
    assert slug_year("/films/action/770-nachalo.html") is None
    assert plugin.parse_cookies("a=1; b=c=d; bad") == {"a": "1", "b": "c=d"}
    assert plugin.parse_cookies("cookie: a=1;\n b=2") == {"a": "1", "b": "2"}


def jwt_with(exp):
    payload = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode()).decode().rstrip("=")
    return f"head.{payload}.sig"


def test_token_expiry():
    assert rezka.token_expiry({"techaro.lol-anubis-auth-x": jwt_with(1796467337), "a": "b"}) == 1796467337
    assert rezka.token_expiry({"a": "b"}) is None
    assert rezka.token_expiry({"techaro.lol-anubis-auth-x": "broken"}) is None


class SavedCookies:
    def __init__(self):
        self.saved = None

    def save_cookies(self, cookies):
        self.saved = cookies


@pytest.fixture
def settings_client(site):
    site.cookies = {"saved-name": "saved-value"}
    site.accepted = True

    def check_access(cookies=None):
        site.tried = cookies
        if not site.accepted:
            raise Blocked()

    site.check_access = check_access
    site.mapping_store = SavedCookies()
    plugin._status.update(at=0.0, ok=None, ip="1.2.3.4")
    matcher = Matcher(site, site.mapping_store)
    plugin.app.dependency_overrides[plugin.get_matcher] = lambda: matcher
    client = TestClient(plugin.app, raise_server_exceptions=False)
    client.matcher = matcher
    yield client
    plugin.app.dependency_overrides.clear()


def test_settings_need_the_token(settings_client):
    assert settings_client.get("/settings").status_code == 401
    assert settings_client.put("/settings", json={"values": {"cookies": "a=1"}}).status_code == 401


def test_settings_never_return_the_cookies(settings_client):
    response = settings_client.get("/settings", headers=AUTH)
    assert response.status_code == 200
    assert response.json()["status"]["ok"] is True
    assert "saved-name" not in response.text and "saved-value" not in response.text
    assert "root@1.2.3.4" in response.text


def test_good_cookies_are_saved_and_used_at_once(settings_client, site):
    token = jwt_with(1796467337)
    settings_client.matcher.pages.put("/x", "stale", 100)
    settings_client.matcher.matches.put("k", None, 100)
    response = settings_client.put("/settings", json={"values": {"cookies": f"cookie: techaro.lol-anubis-auth-x={token}; a=1"}}, headers=AUTH)
    assert response.status_code == 200
    assert response.json()["status"]["expires_at"] == 1796467337
    assert site.mapping_store.saved["a"] == "1"
    assert site.cookies["a"] == "1"
    assert settings_client.matcher.pages.get("/x") is None
    assert settings_client.matcher.matches.get("k", default=False) is False
    assert token not in response.text


def test_rejected_cookies_change_nothing(settings_client, site):
    site.accepted = False
    response = settings_client.put("/settings", json={"values": {"cookies": "a=1"}}, headers=AUTH)
    assert response.status_code == 400
    assert "тунель" in response.json()["detail"]
    assert site.mapping_store.saved is None
    assert site.cookies == {"saved-name": "saved-value"}


def test_empty_cookies_are_refused(settings_client, site):
    assert settings_client.put("/settings", json={"values": {"cookies": "nothing here"}}, headers=AUTH).status_code == 400
    assert site.mapping_store.saved is None


def test_status_reports_broken_cookies(settings_client, site):
    site.accepted = False
    assert settings_client.get("/settings", headers=AUTH).json()["status"]["ok"] is False


def test_status_is_not_checked_on_every_request(settings_client, site):
    settings_client.get("/settings", headers=AUTH)
    site.accepted = False
    assert settings_client.get("/settings", headers=AUTH).json()["status"]["ok"] is True
