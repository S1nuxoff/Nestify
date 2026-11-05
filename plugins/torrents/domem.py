"""The domem.ws embedded player, found by IMDb id."""

import json
import re

import httpx

TIMEOUT = 12.0
TITLE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
EMBED_ID = re.compile(r"\bid=\s*(\d+)\s*,")
HLS = re.compile(r'hls:\s*"([^"]+)"')
DASH = re.compile(r'dash:\s*"([^"]+)"')
AUDIO = re.compile(r'audio:\s*(\{.*?\})\s*,\s*cc:', re.DOTALL)
SUBTITLES = re.compile(r'cc:\s*(\[[\s\S]*?\])\s*\n', re.DOTALL)


def _json_block(pattern: re.Pattern, html: str):
    match = pattern.search(html)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except ValueError:
        return None


def parse_embed(html: str, imdb_id: str, url: str) -> dict | None:
    title_match = TITLE.search(html)
    title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else None
    hls, dash, embed_id = HLS.search(html), DASH.search(html), EMBED_ID.search(html)
    audio, subtitles = _json_block(AUDIO, html), _json_block(SUBTITLES, html)
    if not any([title, hls, dash, audio, subtitles, embed_id]):
        return None
    return {
        "provider": "domem",
        "imdb_id": imdb_id,
        "embed_url": url,
        "embed_id": int(embed_id.group(1)) if embed_id else None,
        "title": title,
        "hls": hls.group(1) if hls else None,
        "dash": dash.group(1) if dash else None,
        "audio": audio or {},
        "subtitles": subtitles or [],
    }


async def fetch_embed(imdb_id: str | None, transport=None) -> dict | None:
    imdb_id = (imdb_id or "").strip()
    if not imdb_id:
        return None
    url = f"https://api.domem.ws/embed/imdb/{imdb_id}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, transport=transport) as client:
            response = await client.get(url, headers={"User-Agent": "Nestify/1.0"})
            response.raise_for_status()
    except Exception:
        return None
    return parse_embed(response.text or "", imdb_id, url)
