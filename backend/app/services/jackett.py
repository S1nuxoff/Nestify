import asyncio
import xml.etree.ElementTree as ET

import requests

from app.core.config import settings

NS = {"torznab": "http://torznab.com/schemas/2015/feed"}


def _search_sync(query: str) -> list[dict]:
    url = f"{settings.JACKETT_URL}/api/v2.0/indexers/all/results/torznab/api"
    params = {"apikey": settings.JACKETT_KEY, "t": "search", "q": query}
    try:
        resp = requests.get(url, params=params, timeout=65)
        resp.raise_for_status()
        return _parse_xml(resp.text)
    except Exception as e:
        print(f"[Jackett] error: {e}", flush=True)
        return []


def _parse_xml(xml_text: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    results = []
    for item in root.findall(".//item"):
        title = item.findtext("title") or ""
        magnet = ""
        enc = item.find("enclosure")
        if enc is not None:
            magnet = enc.get("url", "")
        if not magnet:
            continue
        size = int(item.findtext("size") or 0)
        attrs = {a.get("name"): a.get("value") for a in item.findall("torznab:attr", NS)}
        results.append({
            "title":   title,
            "magnet":  magnet,
            "size":    size,
            "seeders": int(attrs.get("seeders", 0)),
            "peers":   int(attrs.get("peers", 0)),
        })
    return results


async def search_torrents(
    q: str,
    title: str | None = None,
    title_original: str | None = None,
    year: int | None = None,
) -> list[dict]:
    query = title_original or title or q
    if year:
        query = f"{query} {year}"

    print(f"[Jackett] searching: {query!r}", flush=True)
    results = await asyncio.to_thread(_search_sync, query)
    print(f"[Jackett] got {len(results)} results", flush=True)
    return results
