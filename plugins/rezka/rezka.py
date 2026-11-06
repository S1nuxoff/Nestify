"""Access to the site and matching of TMDB titles against it."""

import base64
import json
import logging
import re
import time
from functools import cached_property
from urllib.parse import urlparse

import psycopg
import requests
from HdRezkaApi import HdRezkaApi
from HdRezkaApi.search import HdRezkaSearch

log = logging.getLogger("rezka-plugin")

CHALLENGE_TITLE = "Проверяем, что вы не бот"
MAX_PAGE_CHECKS = 4
YEAR_TOLERANCE = 1
MATCH_TTL = 24 * 60 * 60
NO_MATCH_TTL = 10 * 60
PAGE_TTL = 10 * 60
CACHE_LIMIT = 500


class Blocked(Exception):
    """The site answered with its bot check: the cookies are missing, expired or for another IP."""


class Page(HdRezkaApi):
    """HdRezkaApi 11.2.3 expects translators as direct children; the site now wraps them in <li>."""

    @cached_property
    def soup(self):
        soup = super().soup
        translators = soup.find(id="translators-list")
        if translators:
            for li in translators.find_all("li", recursive=False):
                link = li.find("a")
                if link:
                    li.replace_with(link)
        return soup


class Site:
    def __init__(self, origin: str, headers: dict, cookies: dict):
        self.origin = origin.rstrip("/")
        self.headers = headers
        self.cookies = cookies

    def search(self, query: str) -> list[dict]:
        return HdRezkaSearch(self.origin, headers=self.headers, cookies=self.cookies)(query)

    def page(self, path: str) -> Page:
        page = Page(f"{self.origin}{path}", headers=self.headers, cookies=self.cookies)
        if CHALLENGE_TITLE in (page.soup.title.text if page.soup.title else ""):
            raise Blocked()
        return page

    def check_access(self, cookies: dict | None = None) -> None:
        response = requests.get(
            f"{self.origin}/", headers=self.headers, cookies=self.cookies if cookies is None else cookies, timeout=20,
        )
        response.raise_for_status()
        if CHALLENGE_TITLE in response.text:
            raise Blocked()


class TtlCache:
    def __init__(self):
        self._items = {}

    def get(self, key, default=None):
        item = self._items.get(key)
        if item is None or item[0] <= time.time():
            return default
        return item[1]

    def put(self, key, value, ttl: int) -> None:
        if len(self._items) >= CACHE_LIMIT:
            self._items.clear()
        self._items[key] = (time.time() + ttl, value)


def normalize(text: str | None) -> str:
    text = (text or "").casefold().replace("ё", "е")
    return " ".join(re.sub(r"[^\w]+", " ", text).split())


def path_of(url: str) -> str:
    return urlparse(url).path


def slug_year(path: str) -> int | None:
    match = re.search(r"-((?:19|20)\d{2})(?:-latest)?\.html$", path)
    return int(match.group(1)) if match else None


def is_type(page, media_type: str) -> bool:
    return page.type.name == ("tv_series" if media_type == "tv" else "movie")


def parse_cookies(value: str) -> dict[str, str]:
    """Takes a browser's cookie header, with or without its "cookie:" name."""
    value = re.sub(r"^\s*cookie\s*:?\s*", "", value, flags=re.I).replace("\n", " ").replace("\r", " ")
    pairs = (part.strip().split("=", 1) for part in value.split(";") if "=" in part)
    return {name.strip(): val.strip() for name, val in pairs}


def token_expiry(cookies: dict[str, str]) -> int | None:
    """When the site's bot check token runs out. It is only read here, not verified."""
    for name, value in cookies.items():
        if "anubis-auth" not in name:
            continue
        try:
            payload = value.split(".")[1]
            return int(json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["exp"])
        except (IndexError, KeyError, TypeError, ValueError):
            return None
    return None


class MapStore:
    """The plugin's database: the rezka_map table, filled by scripts/import_mapping.py, and settings."""

    def __init__(self, url: str):
        self.url = url

    def load_cookies(self) -> dict[str, str] | None:
        with psycopg.connect(self.url, connect_timeout=5) as db:
            db.execute("CREATE TABLE IF NOT EXISTS plugin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            row = db.execute("SELECT value FROM plugin_settings WHERE key = 'cookies'").fetchone()
        return json.loads(row[0]) if row else None

    def save_cookies(self, cookies: dict[str, str]) -> None:
        with psycopg.connect(self.url, connect_timeout=5) as db:
            db.execute("CREATE TABLE IF NOT EXISTS plugin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            db.execute(
                "INSERT INTO plugin_settings (key, value) VALUES ('cookies', %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (json.dumps(cookies),),
            )

    def lookup(self, media_type: str, tmdb_id: str | None, imdb_id: str | None) -> list[str]:
        with psycopg.connect(self.url, connect_timeout=5) as db:
            if tmdb_id:
                rows = db.execute(
                    "SELECT rezka_path FROM rezka_map WHERE tmdb_id = %s AND tmdb_type = %s",
                    (tmdb_id, media_type),
                ).fetchall()
                if rows:
                    return [row[0] for row in rows]
            if imdb_id:
                rows = db.execute("SELECT rezka_path FROM rezka_map WHERE imdb_id = %s", (imdb_id,)).fetchall()
                return [row[0] for row in rows]
        return []

    def remember(self, path: str, title: str, media_type: str, tmdb_id: str | None, imdb_id: str | None) -> None:
        """Record a title found by name. Ids already in the table are never replaced."""
        with psycopg.connect(self.url, connect_timeout=5) as db:
            db.execute(
                """
                INSERT INTO rezka_map (rezka_path, title, type, year, tmdb_id, tmdb_type, imdb_id, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'SEARCH')
                ON CONFLICT (rezka_path) DO UPDATE SET
                    tmdb_id = COALESCE(rezka_map.tmdb_id, EXCLUDED.tmdb_id),
                    tmdb_type = COALESCE(rezka_map.tmdb_type, EXCLUDED.tmdb_type),
                    imdb_id = COALESCE(rezka_map.imdb_id, EXCLUDED.imdb_id),
                    updated_at = now()
                WHERE rezka_map.tmdb_id IS NULL OR rezka_map.imdb_id IS NULL
                """,
                (path, title, media_type, slug_year(path), tmdb_id, media_type if tmdb_id else None, imdb_id),
            )


class Matcher:
    def __init__(self, site, mapping=None):
        self.site = site
        self.mapping = mapping
        self.matches = TtlCache()
        self.pages = TtlCache()

    def page(self, path: str):
        page = self.pages.get(path)
        if page is None:
            page = self.site.page(path)
            page._path = path
            self.pages.put(path, page, PAGE_TTL)
        return page

    def find(self, media_type: str, title: str, original_title: str | None, year: int | None,
             tmdb_id: str | None = None, imdb_id: str | None = None):
        """Return the page of this exact title, or None. A wrong film is worse than no film."""
        key = (media_type, normalize(title), normalize(original_title), year, tmdb_id, imdb_id)
        cached = self.matches.get(key, default=False)
        if cached is not False:
            return self.page(cached) if cached else None
        page = self._from_map(media_type, title, original_title, year, tmdb_id, imdb_id)
        if page is None:
            page = self._search(media_type, title, original_title, year)
            if page is not None:
                self._remember(page, media_type, tmdb_id, imdb_id)
        if page is None:
            self.matches.put(key, None, NO_MATCH_TTL)
            return None
        self.matches.put(key, page._path, MATCH_TTL)
        return page

    def _from_map(self, media_type, title, original_title, year, tmdb_id, imdb_id):
        if not self.mapping or not (tmdb_id or imdb_id):
            return None
        try:
            paths = self.mapping.lookup(media_type, tmdb_id, imdb_id)
        except Exception:
            log.exception("rezka_map lookup failed, falling back to search")
            return None
        wanted = {normalize(title), normalize(original_title)} - {""}
        for path in paths[:MAX_PAGE_CHECKS]:
            try:
                page = self.page(path)
            except Blocked:
                raise
            except Exception:
                # The page may have been removed from the site since the table was filled.
                log.warning("mapped page is unavailable: %s", path)
                continue
            if not is_type(page, media_type):
                continue
            if len(paths) == 1:
                return page
            # Several pages share this id, so the id alone does not tell which one is right.
            known = slug_year(path)
            year_ok = not (year and known and abs(known - year) > YEAR_TOLERANCE)
            if year_ok and {normalize(n) for n in [*page.names, *page.origNames]} & wanted:
                return page
        return None

    def _remember(self, page, media_type, tmdb_id, imdb_id):
        if not self.mapping or not (tmdb_id or imdb_id):
            return
        try:
            self.mapping.remember(page._path, page.names[0], media_type, tmdb_id, imdb_id)
        except Exception:
            log.exception("could not save a match to rezka_map")

    def _search(self, media_type, title, original_title, year):
        wanted = {normalize(title), normalize(original_title)} - {""}
        queries = list(dict.fromkeys(q for q in (original_title, title) if q))
        found: dict[str, str] = {}
        for query in queries:
            for item in self.site.search(query):
                found.setdefault(path_of(item["url"]), item["title"])
        if not found:
            # A bot check also looks like an empty result, and must not be cached as "not found".
            self.site.check_access()
            return None

        def rank(entry):
            path, name = entry
            known = slug_year(path)
            return (normalize(name) not in wanted, abs(known - year) if year and known else 0)

        candidates = [
            entry for entry in sorted(found.items(), key=rank)
            if not (year and slug_year(entry[0]) and abs(slug_year(entry[0]) - year) > YEAR_TOLERANCE)
        ]
        for path, _ in candidates[:MAX_PAGE_CHECKS]:
            page = self.page(path)
            names = {normalize(n) for n in [*page.names, *page.origNames]}
            if is_type(page, media_type) and names & wanted:
                return page
        return None
