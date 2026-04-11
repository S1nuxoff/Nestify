from __future__ import annotations

import json
import re

import httpx

_TIMEOUT = 12.0

_TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_ID_RE = re.compile(r"\bid=\s*(\d+)\s*,")
_HLS_RE = re.compile(r'hls:\s*"([^"]+)"')
_DASH_RE = re.compile(r'dash:\s*"([^"]+)"')
_AUDIO_RE = re.compile(r'audio:\s*(\{.*?\})\s*,\s*cc:', re.DOTALL)
_CC_RE = re.compile(r'cc:\s*(\[[\s\S]*?\])\s*\n', re.DOTALL)


def _extract_title(html: str) -> str | None:
    match = _TITLE_RE.search(html or "")
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1)).strip()


def _extract_json_block(pattern: re.Pattern[str], html: str):
    match = pattern.search(html or "")
    if not match:
        return None
    raw = match.group(1)
    try:
        return json.loads(raw)
    except Exception:
        return None


async def fetch_embed_by_imdb(imdb_id: str | None) -> dict | None:
    if not imdb_id:
        return None

    imdb_id = imdb_id.strip()
    if not imdb_id:
        return None

    url = f"https://api.domem.ws/embed/imdb/{imdb_id}"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "Nestify/1.0"})
            response.raise_for_status()
    except Exception:
        return None

    html = response.text or ""
    if not html:
        return None

    title = _extract_title(html)
    hls_match = _HLS_RE.search(html)
    dash_match = _DASH_RE.search(html)
    id_match = _ID_RE.search(html)
    audio = _extract_json_block(_AUDIO_RE, html)
    cc = _extract_json_block(_CC_RE, html)

    hls = hls_match.group(1) if hls_match else None
    dash = dash_match.group(1) if dash_match else None
    embed_id = int(id_match.group(1)) if id_match else None

    if not any([title, hls, dash, audio, cc, embed_id]):
        return None

    return {
        "provider": "domem",
        "imdb_id": imdb_id,
        "embed_url": url,
        "embed_id": embed_id,
        "title": title,
        "hls": hls,
        "dash": dash,
        "audio": audio or {},
        "subtitles": cc or [],
    }
