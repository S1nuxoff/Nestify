from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select

from app.db.session import async_session
from app.models.liked_movies import LikedMovie


def _serialize_liked_movie(row: LikedMovie) -> dict:
    payload = row.payload or {}
    return {
        "id": row.movie_id or payload.get("id") or f"liked-{row.id}",
        "movie_id": row.movie_id,
        "link": row.link,
        "title": row.title,
        "origin_name": row.origin_name,
        "image": row.image,
        "description": row.description,
        "release_date": row.release_date,
        "action": row.action,
        "type": row.media_type or payload.get("type"),
        "updated_at": row.updated_at,
        "liked_at": row.created_at,
        **payload,
    }


async def get_liked_movies(user_id: int) -> list[dict]:
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(LikedMovie)
                .where(LikedMovie.user_id == user_id)
                .order_by(LikedMovie.updated_at.desc())
            )
            rows = result.scalars().all()
            return [_serialize_liked_movie(row) for row in rows]


async def is_movie_liked(user_id: int, link: str) -> bool:
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(LikedMovie.id).where(
                    LikedMovie.user_id == user_id,
                    LikedMovie.link == link,
                )
            )
            return result.scalar_one_or_none() is not None


async def add_liked_movie(user_id: int, payload: dict) -> dict:
    link = (payload.get("link") or "").strip()
    title = (payload.get("title") or "").strip()
    if not link:
        raise ValueError("Movie link is required")
    if not title:
        raise ValueError("Movie title is required")

    now = datetime.utcnow()

    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(LikedMovie).where(
                    LikedMovie.user_id == user_id,
                    LikedMovie.link == link,
                )
            )
            liked_movie = result.scalar_one_or_none()

            if liked_movie is None:
                liked_movie = LikedMovie(user_id=user_id, link=link, title=title)
                session.add(liked_movie)

            liked_movie.movie_id = payload.get("movie_id") or payload.get("id")
            liked_movie.title = title
            liked_movie.origin_name = payload.get("origin_name")
            liked_movie.image = payload.get("image")
            liked_movie.description = payload.get("description")
            liked_movie.release_date = payload.get("release_date")
            liked_movie.action = payload.get("action")
            liked_movie.media_type = payload.get("type")
            liked_movie.payload = payload
            liked_movie.updated_at = now

        await session.refresh(liked_movie)
        return _serialize_liked_movie(liked_movie)


async def remove_liked_movie(user_id: int, link: str) -> bool:
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                delete(LikedMovie)
                .where(LikedMovie.user_id == user_id, LikedMovie.link == link)
                .returning(LikedMovie.id)
            )
            deleted_id = result.scalar_one_or_none()
            return deleted_id is not None
