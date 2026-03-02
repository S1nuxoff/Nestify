import os
import httpx

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "4ef0d7355d9ffb5151e987764708ce96")
TMDB_BASE = "https://api.themoviedb.org/3"

# Priority order for trailer language selection
_LANG_PRIORITY = ["uk", "ru", "en"]


def _pick_trailer(videos: list[dict], lang: str | None = None) -> str | None:
    """Return best YouTube key from video list, optionally filtered by iso_639_1."""
    yt = [v for v in videos if v.get("site") == "YouTube"]
    if lang:
        yt = [v for v in yt if v.get("iso_639_1") == lang]
    for v in yt:
        if v.get("type") == "Trailer":
            return v["key"]
    for v in yt:
        if v.get("type") == "Teaser":
            return v["key"]
    return yt[0]["key"] if yt else None


async def get_tmdb_trailer(tmdb_id: str, tmdb_type: str) -> str | None:
    """Returns YouTube key with language priority: uk → ru → en → original."""
    url = f"{TMDB_BASE}/{tmdb_type}/{tmdb_id}/videos"

    async with httpx.AsyncClient(timeout=10) as client:
        # One request to get uk + ru + en + original videos all at once
        resp = await client.get(url, params={
            "api_key": TMDB_API_KEY,
            "language": "uk-UA",
            "include_video_language": "uk,ru,en,null",
        })

        if resp.status_code != 200:
            return None

        videos = resp.json().get("results", [])

        # Try each language in priority order
        for lang in _LANG_PRIORITY:
            key = _pick_trailer(videos, lang=lang)
            if key:
                return key

        # Fallback: any YouTube video regardless of language
        return _pick_trailer(videos)
