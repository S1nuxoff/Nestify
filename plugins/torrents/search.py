"""Torrent search: JacRed for Ukrainian and Russian releases, Jackett for English and Polish ones."""

import asyncio
import logging
import os
import re
import xml.etree.ElementTree as ET

import httpx

log = logging.getLogger("torrents-plugin")

TIMEOUT = 12
TORZNAB = {"torznab": "http://torznab.com/schemas/2015/feed"}
UK_TRACKERS = {"toloka"}
RU_TRACKERS = {"rutor", "kinozal", "rutracker", "nnmclub", "selezen", "bitru", "torrentby", "underverse"}
CYRILLIC = re.compile(r"[а-яёА-ЯЁіїєІЇЄ]")
QUALITY_STEPS = ((2160, "4K"), (1080, "1080p"), (720, "720p"), (480, "480p"))


def _flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    return default if value is None else value.strip().lower() in ("1", "true", "yes")


def _names(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    def __init__(self):
        self.jackett_url = os.environ.get("JACKETT_URL", "").rstrip("/")
        self.jackett_key = os.environ.get("JACKETT_KEY", "")
        self.en_enabled = _flag("JACKETT_EN_ENABLED", True)
        self.en_indexers = _names(os.environ.get("JACKETT_EN_INDEXERS", "yts,eztv,therarb,torrentgalaxy,thepiratebay,limetorrents,knaben"))
        self.pl_enabled = _flag("JACKETT_PL_ENABLED", True)
        self.pl_indexer = os.environ.get("JACKETT_PL_INDEXER", "polskie-torrenty")
        self.jacred_url = os.environ.get("JACRED_URL", "https://jac.red").rstrip("/")
        self.jacred_enabled = _flag("JACRED_ENABLED", True)
        self.jacred_own_url = os.environ.get("JACRED_OWN_URL", "").rstrip("/")
        self.jacred_own_enabled = _flag("JACRED_OWN_ENABLED", False)


def quality_label(value) -> str | None:
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return next((label for step, label in QUALITY_STEPS if value >= step), None)


def parse_jacred(data) -> list[dict]:
    results = []
    for item in data if isinstance(data, list) else []:
        magnet = item.get("magnet") or ""
        if not magnet:
            continue
        results.append({
            "title": item.get("title") or "",
            "magnet": magnet,
            "size": int(item.get("size", 0) or 0),
            "seeders": int(item.get("sid", 0) or 0),
            "peers": int(item.get("pir", 0) or 0),
            "pub_date": item.get("createTime") or "",
            "tracker": item.get("tracker") or "",
            "voices": item.get("voices") or [],
            "quality": quality_label(item.get("quality")),
            "videotype": item.get("videotype") or "",
        })
    return results


def parse_torznab(xml_text: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    results = []
    for item in root.findall(".//item"):
        enclosure = item.find("enclosure")
        magnet = (enclosure.get("url", "") if enclosure is not None else "") or ""
        if not magnet:
            for tag in ("link", "guid"):
                text = item.findtext(tag) or ""
                if text.startswith("magnet:"):
                    magnet = text
                    break
        if not magnet:
            continue
        attrs = {a.get("name"): a.get("value") for a in item.findall("torznab:attr", TORZNAB)}
        results.append({
            "title": item.findtext("title") or "",
            "magnet": magnet,
            "size": int(item.findtext("size") or 0),
            "seeders": int(attrs.get("seeders", 0) or 0),
            "peers": int(attrs.get("peers", 0) or 0),
            "pub_date": item.findtext("pubDate") or "",
        })
    return results


def dedup(items: list[dict]) -> list[dict]:
    seen, out = set(), []
    for item in items:
        if item["magnet"] not in seen:
            seen.add(item["magnet"])
            out.append(item)
    return out


def by_seeders(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda item: item.get("seeders", 0), reverse=True)


def flatten(results) -> list[dict]:
    return [item for group in results if not isinstance(group, BaseException) for item in group]


class Searcher:
    def __init__(self, config: Config, transport=None):
        self.config = config
        self.transport = transport

    async def _jacred(self, client, base_url: str, query: str) -> list[dict]:
        try:
            response = await client.get(
                f"{base_url}/api/v1.0/torrents",
                params={"search": query, "apikey": "null", "exact": "false"},
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            return parse_jacred(response.json())
        except Exception as exc:
            log.warning("JacRed failed: %s", type(exc).__name__)
            return []

    async def _indexer(self, client, indexer: str, query: str) -> list[dict]:
        url = f"{self.config.jackett_url}/api/v2.0/indexers/{indexer}/results/torznab/api"
        try:
            response = await client.get(
                url, params={"apikey": self.config.jackett_key, "t": "search", "q": query}, timeout=TIMEOUT,
            )
            if response.status_code == 404:
                return []
            response.raise_for_status()
            return parse_torznab(response.text)
        except Exception as exc:
            # The exception text contains the URL with the Jackett key, so only its type is logged.
            log.warning("Jackett %s failed: %s", indexer, type(exc).__name__)
            return []

    async def _english(self, client, english: str, year, media_type) -> list[dict]:
        queries = [f"{english} {year}"] if year else []
        queries.append(english)
        if media_type == "tv":
            queries.append(f"{english} S01")
        queries = list(dict.fromkeys(queries))[:3]
        results = await asyncio.gather(
            *(self._indexer(client, indexer, q) for q in queries for indexer in self.config.en_indexers),
            return_exceptions=True,
        )
        # Releases with a Cyrillic name belong to the Ukrainian and Russian lists.
        return dedup([item for item in flatten(results) if not CYRILLIC.search(item.get("title", ""))])

    async def _polish(self, client, title: str, year) -> list[dict]:
        queries = ([f"{title} {year}"] if year else []) + [title]
        results = await asyncio.gather(
            *(self._indexer(client, self.config.pl_indexer, q) for q in queries[:2]), return_exceptions=True,
        )
        return dedup(flatten(results))

    async def search(self, *, title=None, original_title=None, title_en=None, title_pl=None, year=None, media_type="movie") -> dict:
        config = self.config
        local = title or ""
        english = title_en or original_title or ""
        bases = []
        if config.jacred_enabled:
            bases.append(config.jacred_url)
        if config.jacred_own_enabled and config.jacred_own_url:
            bases.append(config.jacred_own_url)
        queries = [local] if local else []
        if english and english.lower() != local.lower():
            queries.append(english)

        async with httpx.AsyncClient(transport=self.transport) as client:
            jacred = await asyncio.gather(
                *(self._jacred(client, base, q) for q in queries for base in bases), return_exceptions=True,
            )
            en = await self._english(client, english, year, media_type) if english and config.en_enabled and config.jackett_url else []
            pl = await self._polish(client, title_pl, year) if title_pl and config.pl_enabled and config.jackett_url else []

        cis = dedup(flatten(jacred))
        return {
            "uk": by_seeders([item for item in cis if item.get("tracker") in UK_TRACKERS]),
            "ru": by_seeders([item for item in cis if item.get("tracker") in RU_TRACKERS]),
            "en": by_seeders(en),
            "pl": by_seeders(pl),
        }
