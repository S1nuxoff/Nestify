import asyncio
import math
import re
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher

import httpx

from app.core.config import settings

# ── indexers ─────────────────────────────────────────────────
def _get_indexers() -> list[str]:
    return [x.strip() for x in settings.JACKETT_INDEXERS.split(",") if x.strip()]

_TIMEOUT = 12

NS = {"torznab": "http://torznab.com/schemas/2015/feed"}

BAD_WORDS  = ("CAM", "HDCAM", "TS", "TELESYNC", "TELECINE")
GOOD_WORDS = ("WEB-DL", "WEBDL", "WEBRIP", "BLURAY", "BLU-RAY", "REMUX", "BDREMUX")
JUNK_WORDS = ("SOUNDTRACK", "OST", "TRAILER", "SAMPLE", "EXTRAS", "BONUS")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# JacRed — пошук по локальній базі (мгновенно)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _quality_str(q) -> str | None:
    try:
        q = int(q)
    except (TypeError, ValueError):
        return None
    if q >= 2160: return "4K"
    if q >= 1080: return "1080p"
    if q >= 720:  return "720p"
    if q >= 480:  return "480p"
    return None


def _parse_jacred_response(data) -> list[dict]:
    results = []
    for t in (data if isinstance(data, list) else []):
        magnet = t.get("magnet") or ""
        if not magnet:
            continue
        results.append({
            "title":     t.get("title") or "",
            "magnet":    magnet,
            "size":      int(t.get("size", 0) or 0),
            "seeders":   int(t.get("sid", 0) or 0),
            "peers":     int(t.get("pir", 0) or 0),
            "pub_date":  t.get("createTime") or "",
            "tracker":   t.get("tracker") or "",
            "voices":    t.get("voices") or [],
            "quality":   _quality_str(t.get("quality")),
            "videotype": t.get("videotype") or "",
        })
    return results


async def _jacred_request(
    client: httpx.AsyncClient,
    base_url: str,
    search: str,
    exact: bool,
    label: str = "JacRed",
) -> list[dict]:
    params: dict = {
        "search": search,
        "apikey": "null",
        "exact":  "true" if exact else "false",
    }
    try:
        resp = await client.get(
            f"{base_url}/api/v1.0/torrents",
            params=params,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return _parse_jacred_response(resp.json())
    except Exception as e:
        print(f"[{label}] error: {e}", flush=True)
        return []


async def _search_jacred(
    client: httpx.AsyncClient,
    title: str | None,
    title_original: str | None,
    year: int | None,
    media_type: str,
) -> list[dict]:
    search = title or title_original or ""
    if not search:
        return []

    tasks = []
    if settings.JACRED_ENABLED:
        tasks.append(_jacred_request(client, settings.JACRED_URL, search, exact=False, label="JacRed.public"))
    if settings.JACRED_OWN_ENABLED:
        tasks.append(_jacred_request(client, settings.JACRED_OWN_URL, search, exact=False, label="JacRed.own"))

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set[str] = set()
    merged: list[dict] = []
    for items in all_results:
        if isinstance(items, Exception):
            continue
        for item in items:
            if item["magnet"] not in seen:
                seen.add(item["magnet"])
                merged.append(item)

    print(f"[JacRed] found {len(merged)} for '{search}' {year}", flush=True)
    return merged


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Jackett — live пошук по індексерах
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _torznab_url(indexer: str) -> str:
    return f"{settings.JACKETT_URL}/api/v2.0/indexers/{indexer}/results/torznab/api"


def _clean(s: str) -> str:
    return re.sub(r"[^\w ]+", " ", s.lower(), flags=re.UNICODE).strip()


def _parse_xml(xml_text: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    results = []
    for item in root.findall(".//item"):
        title = item.findtext("title") or ""
        size  = int(item.findtext("size") or 0)

        magnet = ""
        enc = item.find("enclosure")
        if enc is not None:
            magnet = enc.get("url", "") or ""
        if not magnet:
            link = item.findtext("link") or ""
            if link.startswith("magnet:"):
                magnet = link
        if not magnet:
            guid = item.findtext("guid") or ""
            if guid.startswith("magnet:"):
                magnet = guid
        if not magnet:
            continue

        attrs   = {a.get("name"): a.get("value") for a in item.findall("torznab:attr", NS)}
        seeders = int(attrs.get("seeders", 0) or 0)
        peers   = int(attrs.get("peers",   0) or 0)
        pub_date = item.findtext("pubDate") or ""

        results.append({
            "title":    title,
            "magnet":   magnet,
            "size":     size,
            "seeders":  seeders,
            "peers":    peers,
            "pub_date": pub_date,
        })

    return results


async def _search_indexer(client: httpx.AsyncClient, indexer: str, query: str) -> list[dict]:
    params = {
        "apikey": settings.JACKETT_KEY,
        "t":      "search",
        "q":      query,
    }
    try:
        resp = await client.get(_torznab_url(indexer), params=params, timeout=_TIMEOUT)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return _parse_xml(resp.text)
    except httpx.TimeoutException:
        print(f"[Jackett:{indexer}] timeout", flush=True)
        return []
    except Exception as e:
        print(f"[Jackett:{indexer}] {e}", flush=True)
        return []


def _build_queries(
    q: str,
    title: str | None,
    title_original: str | None,
    title_en: str | None,
    year: int | None,
    media_type: str,
) -> list[str]:
    variants = []

    if title_en and year:
        variants.append(f"{title_en} {year}")
    if title_en:
        variants.append(title_en)
    if title_original and year:
        variants.append(f"{title_original} {year}")
    if title and year and title != title_original:
        variants.append(f"{title} {year}")
    if title_original:
        variants.append(title_original)
    if title and title != title_original:
        variants.append(title)
    variants.append(q)

    if media_type in ("tv", "series"):
        extra = []
        for v in variants:
            extra.append(v)
            extra.append(f"{v} S01")
        variants = extra

    seen, out = set(), []
    for v in variants:
        vv = v.strip()
        if vv and vv not in seen:
            seen.add(vv)
            out.append(vv)
    return out[:4]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Трекери по мові
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UK_TRACKERS = {"toloka"}
RU_TRACKERS = {"rutor", "kinozal", "rutracker", "nnmclub", "selezen", "bitru", "torrentby", "underverse"}


def _dedup(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for item in items:
        if item["magnet"] not in seen:
            seen.add(item["magnet"])
            out.append(item)
    return out


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Мультимовний пошук
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_CYRILLIC_RE = re.compile(r"[а-яёА-ЯЁіїєІЇЄ]")


def _is_english_title(title: str) -> bool:
    """Return True if title has no Cyrillic — i.e. it's an English release."""
    return not _CYRILLIC_RE.search(title)


def _sort_by_seeders(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda x: x.get("seeders", 0), reverse=True)


def _get_en_indexers() -> list[str]:
    return [x.strip() for x in settings.JACKETT_EN_INDEXERS.split(",") if x.strip()]


async def _search_jackett_pl(
    client: httpx.AsyncClient,
    title_pl: str,
    year: int | None,
    media_type: str,
) -> list[dict]:
    """Search Polish indexer via Jackett for the PL tab."""
    indexer = settings.JACKETT_PL_INDEXER
    queries: list[str] = []
    if year:
        queries.append(f"{title_pl} {year}")
    queries.append(title_pl)

    tasks = [_search_indexer(client, indexer, q) for q in queries[:2]]
    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    items: list[dict] = []
    for r in all_results:
        if not isinstance(r, Exception):
            items.extend(r)
    return _dedup(items)


async def _search_jackett_en(
    client: httpx.AsyncClient,
    english: str,
    year: int | None,
    media_type: str,
) -> list[dict]:
    """Search English indexers via Jackett for the EN tab."""
    indexers = _get_en_indexers()
    if not indexers:
        return []

    queries: list[str] = []
    if year:
        queries.append(f"{english} {year}")
    queries.append(english)
    if media_type in ("tv", "series") and english:
        queries.append(f"{english} S01")

    seen_q: set[str] = set()
    unique_queries = [q for q in queries if q not in seen_q and not seen_q.add(q)]  # type: ignore[func-returns-value]

    tasks = [
        _search_indexer(client, idx, q)
        for q in unique_queries[:3]
        for idx in indexers
    ]
    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    items: list[dict] = []
    for r in all_results:
        if not isinstance(r, Exception):
            items.extend(r)

    # Відфільтровуємо будь-які результати з кирилицею в назві
    items = [i for i in items if _is_english_title(i.get("title", ""))]
    return _dedup(items)


async def search_multilang(
    title: str | None = None,
    title_original: str | None = None,
    title_en: str | None = None,
    title_pl: str | None = None,
    year: int | None = None,
    media_type: str = "movie",
) -> dict:
    cyrillic = title or ""
    english  = title_en or title_original or ""

    async with httpx.AsyncClient() as client:
        # ── uk/ru: JacRed (public + own), кирилиця + англ якщо різні ──
        # JacRed — кирилиця + англ (бо рос. торенти мають назву "Назва / Title [...]")
        # Але результати JacRed ніколи не йдуть в EN — тільки uk/ru
        jacred_tasks = []
        if cyrillic:
            if settings.JACRED_ENABLED:
                jacred_tasks.append(_jacred_request(client, settings.JACRED_URL, cyrillic, exact=False, label="JacRed.public"))
            if settings.JACRED_OWN_ENABLED:
                jacred_tasks.append(_jacred_request(client, settings.JACRED_OWN_URL, cyrillic, exact=False, label="JacRed.own"))

        if english and english.lower() != cyrillic.lower():
            if settings.JACRED_ENABLED:
                jacred_tasks.append(_jacred_request(client, settings.JACRED_URL, english, exact=False, label="JacRed.public.en"))
            if settings.JACRED_OWN_ENABLED:
                jacred_tasks.append(_jacred_request(client, settings.JACRED_OWN_URL, english, exact=False, label="JacRed.own.en"))

        jacred_results_raw = await asyncio.gather(*jacred_tasks, return_exceptions=True)

        # ── en: Jackett EN indexers only ──
        if english and settings.JACKETT_EN_ENABLED:
            en_items = await _search_jackett_en(client, english, year, media_type)
        else:
            en_items = []

        # ── pl: Jackett polskie-torrenty only ──
        if title_pl and settings.JACKETT_PL_ENABLED:
            pl_items = await _search_jackett_pl(client, title_pl, year, media_type)
        else:
            pl_items = []

    # Merge JacRed results
    cis_items: list[dict] = []
    for items in jacred_results_raw:
        if not isinstance(items, Exception):
            cis_items.extend(items)
    cis_items = _dedup(cis_items)

    uk_items = [r for r in cis_items if r.get("tracker") in UK_TRACKERS]
    ru_items = [r for r in cis_items if r.get("tracker") in RU_TRACKERS]

    uk = _sort_by_seeders(uk_items)
    ru = _sort_by_seeders(ru_items)
    en = _sort_by_seeders(en_items)
    pl = _sort_by_seeders(pl_items)

    print(f"[MultiLang] uk={len(uk)} ru={len(ru)} en={len(en)} pl={len(pl)}", flush=True)
    return {"uk": uk, "ru": ru, "en": en, "pl": pl}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Основна функція пошуку — JacRed + Jackett
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def search_torrents(
    q: str,
    title: str | None = None,
    title_original: str | None = None,
    title_en: str | None = None,
    year: int | None = None,
    imdb_id: str | None = None,
    tmdb_id: str | None = None,
    media_type: str = "movie",
) -> list[dict]:

    target   = title_en or title_original or title or q
    queries  = _build_queries(q, title, title_original, title_en, year, media_type)
    indexers = _get_indexers()

    print(f"[Search] target='{target}' queries={queries}", flush=True)

    async with httpx.AsyncClient() as client:
        tasks = []

        if settings.JACRED_ENABLED or settings.JACRED_OWN_ENABLED:
            tasks.append(_search_jacred(client, title, title_original, year, media_type))

        if settings.JACKETT_ENABLED:
            tasks += [
                _search_indexer(client, idx, qry)
                for qry in queries
                for idx in indexers
            ]

        all_results = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set[str] = set()
    merged: list[dict] = []

    for items in all_results:
        if isinstance(items, Exception):
            continue
        for item in items:
            if item["magnet"] not in seen:
                seen.add(item["magnet"])
                merged.append(item)

    print(f"[Search] total unique: {len(merged)}", flush=True)
    return _sort(merged, target, year)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Сортування
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _sort(items: list[dict], target: str, year: int | None) -> list[dict]:
    items.sort(key=lambda x: _score(x, target, year), reverse=True)
    return items


def _score(item: dict, target: str, year: int | None) -> float:
    t  = item["title"].lower()
    up = item["title"].upper()
    score = 0.0

    clean_target = _clean(target)
    clean_title  = _clean(t)

    ratio = SequenceMatcher(None, clean_target, clean_title).ratio()
    score += ratio * 50

    if clean_target in clean_title:
        score += 15

    if year:
        if str(year) in t:
            score += 20
        elif str(year - 1) in t or str(year + 1) in t:
            score += 3

    seeders = item.get("seeders", 0)
    if seeders > 0:
        score += min(math.log10(seeders + 1) * 10, 20)

    gb = item.get("size", 0) / (1024 ** 3)
    if 1 <= gb <= 25:
        score += 5
    elif gb > 80:
        score -= 8

    if any(k in up for k in GOOD_WORDS):
        score += 6
    if any(k in up for k in BAD_WORDS):
        score -= 20
    if any(k in up for k in JUNK_WORDS):
        score -= 25

    if any(k in up for k in ("2160P", "4K", "UHD")):
        score += 3
    elif "1080P" in up:
        score += 2

    return score
