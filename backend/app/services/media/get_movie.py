# app/services/media/get_movie.py

from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from app.db.session import async_session
from app.models.movies import Movie


async def get_movie_db(movie_id: str) -> Optional[Movie]:
    """
    Возвращает ORM Movie из БД по id или None.
    """
    if not movie_id:
        return None

    async with async_session() as session:
        result = await session.execute(select(Movie).where(Movie.id == movie_id))
        return result.scalars().first()
