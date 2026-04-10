from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx
from fastapi import APIRouter, Query
from sqlalchemy import select, desc

from app.core.config import settings
from app.db.session import async_session
from app.models.watch_history import WatchHistory

router = APIRouter()

GENRE_MAP: dict[int, str] = {
    28: "Бойовик", 12: "Пригоди", 16: "Анімація", 35: "Комедія",
    80: "Кримінал", 99: "Документальний", 18: "Драма", 10751: "Сімейний",
    14: "Фентезі", 36: "Історичний", 27: "Жахи", 10402: "Музика",
    9648: "Детектив", 10749: "Мелодрама", 878: "Фантастика", 53: "Трилер",
    10752: "Воєнний", 37: "Вестерн", 10759: "Екшн", 10762: "Дитячий",
    10765: "Sci-Fi & Fantasy", 10768: "Воєнна & Політика",
}

_TMDB_ID_RE = re.compile(r"^tmdb_(movie|tv)_(\d+)$")


def _tmdb_img(path: str | None, size: str = "w1280") -> str | None:
    if not path:
        return None
    return f"{settings.TMDB_IMG}/{size}{path}"


def _normalize(item: dict[str, Any], media_type: str | None = None) -> dict[str, Any]:
    mt = item.get("media_type") or media_type or "movie"
    if mt == "person":
        mt = "movie"

    title = item.get("title") or item.get("name") or ""
    release = (item.get("release_date") or item.get("first_air_date") or "")[:4]
    rating = item.get("vote_average") or 0.0

    genre_ids: list[int] = item.get("genre_ids") or []
    genres = [GENRE_MAP[g] for g in genre_ids if g in GENRE_MAP][:2]

    return {
        "tmdb_id": item.get("id"),
        "media_type": mt,
        "title": title,
        "backdrop_url": _tmdb_img(item.get("backdrop_path"), "w1280"),
        "poster_url": _tmdb_img(item.get("poster_path"), "w500"),
        "genres": genres,
        "year": release,
        "rating": f"{rating:.1f}" if rating else "",
        "overview": item.get("overview") or "",
    }


async def _tmdb_get(client: httpx.AsyncClient, path: str, **params) -> dict:
    resp = await client.get(
        f"{settings.TMDB_BASE}{path}",
        params={"api_key": settings.TMDB_KEY, "language": "uk-UA", **params},
        timeout=8,
    )
    resp.raise_for_status()
    return resp.json()


@router.get("/featured", summary="Featured recommendations for TV player")
async def get_featured(
    user_id: int | None = Query(None),
    limit: int = Query(12, le=30),
) -> list[dict]:
    if not settings.TMDB_KEY:
        return []

    async with httpx.AsyncClient() as client:
        # 1. History → extract TMDB ids
        history_ids: list[tuple[int, str]] = []
        if user_id:
            async with async_session() as session:
                rows = (await session.execute(
                    select(WatchHistory)
                    .where(WatchHistory.user_id == user_id)
                    .order_by(desc(WatchHistory.updated_at))
                    .limit(10)
                )).scalars().all()

            for row in rows:
                m = _TMDB_ID_RE.match(row.movie_id or "")
                if m:
                    history_ids.append((int(m.group(2)), m.group(1)))

        # 2. Recommendations for last 3 watched
        seen: set[int] = set()
        results: list[dict] = []

        async def fetch_recs(tmdb_id: int, media_type: str) -> list[dict]:
            try:
                data = await _tmdb_get(client, f"/{media_type}/{tmdb_id}/recommendations", page=1)
                return data.get("results") or []
            except Exception:
                return []

        if history_ids:
            rec_lists = await asyncio.gather(*[
                fetch_recs(tid, mt) for tid, mt in history_ids[:3]
            ])
            for items in rec_lists:
                for item in items:
                    iid = item.get("id")
                    if iid and iid not in seen and item.get("backdrop_path"):
                        seen.add(iid)
                        results.append(_normalize(item))
                    if len(results) >= limit:
                        break
                if len(results) >= limit:
                    break

        # 3. Fallback: trending
        if len(results) < 5:
            try:
                data = await _tmdb_get(client, "/trending/all/week")
                for item in (data.get("results") or []):
                    iid = item.get("id")
                    if iid and iid not in seen and item.get("backdrop_path"):
                        seen.add(iid)
                        results.append(_normalize(item))
                    if len(results) >= limit:
                        break
            except Exception:
                pass

    return results[:limit]
