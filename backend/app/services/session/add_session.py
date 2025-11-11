# app/services/add_session.py

from app.core.global_state import live_session
from app.db.session import async_session
from sqlalchemy import select
from app.models.movies import Movie
from app.websockets.manager import ws_manager
from app.services.media.add_movie_to_history import add_movie_to_history


async def add_session(
    movie_id: str,
    position: int = 0,
    translator_id: int = None,
    season_id: int = None,
    episode_id: int = None,
    user_id: int = None,
):
    async with async_session() as session:
        async with session.begin():
            movie_query = await session.execute(
                select(Movie).where(Movie.id == movie_id)
            )
            movie = movie_query.scalars().first()
            if not movie:
                return None

            live_session.update(
                {
                    "id": movie.id,
                    "filmLink": movie.link,
                    "title": movie.title,
                    "origin_name": movie.origin_name,
                    "image": movie.image,
                    "position": position,
                    "translator_id": translator_id,
                    "season_id": season_id,
                    "episode_id": episode_id,
                    "action": movie.action,
                }
            )
            await add_movie_to_history(
                user_id,
                movie_id,
                translator_id,
                movie.action,
                season_id,
                episode_id,
            )
            await ws_manager.broadcast(live_session)

    return movie
