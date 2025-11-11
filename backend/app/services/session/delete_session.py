# app/services/delete_session.py

from app.core.global_state import live_session
from app.db.session import async_session
from sqlalchemy import select
from app.models.movies import Movie
from app.websockets.manager import ws_manager


async def delete_session():
    async with async_session() as session:
        async with session.begin():
            live_session.update(
                {
                    "id": None,
                    "filmLink": None,
                    "title": None,
                    "origin_name": None,
                    "image": None,
                    "position": None,
                    "translator_id": None,
                    "season_id": None,
                    "episode_id": None,
                    "action": None,
                }
            )

            await ws_manager.broadcast(live_session)

    return Movie
