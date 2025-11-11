# app/websockets/manager.py
from typing import Dict, List
from fastapi import WebSocket
from sqlalchemy import select

from app.models.sessions import Session as SessionModel
from app.models.movies import Movie
from app.db.session import async_session


class WebSocketManager:
    def __init__(self):
        # user_id -> list[WebSocket]
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        conns = self.active_connections.get(user_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(user_id, None)

    async def _get_session_payload(self, user_id: int) -> dict:
        """
        Один раз сходили в базу, зібрали json для відправки.
        """
        async with async_session() as session:
            result = await session.execute(
                select(SessionModel).where(SessionModel.user_id == user_id)
            )
            sess = result.scalars().first()

            if not sess:
                return {"live_session": None}

            movie_result = await session.execute(
                select(Movie).where(Movie.id == sess.movie_id)
            )
            movie = movie_result.scalars().first()

            movie_data = (
                {
                    "id": movie.id,
                    "title": movie.title,
                    "origin_name": movie.origin_name,
                    "image": movie.image,
                    "duration": movie.duration,
                    "description": movie.description,
                    "rate": movie.rate,
                    "genre": movie.genre,
                    "country": movie.country,
                    "director": movie.director,
                    "age": movie.age,
                    "link": movie.link,
                    "action": movie.action,
                    "favs": movie.favs,
                    "trailer": movie.trailer,
                    "imdb_id": movie.imdb_id,
                    "translator_ids": movie.translator_ids,
                    "season_ids": movie.season_ids,
                    "episodes_schedule": movie.episodes_schedule,
                    "release_date": movie.release_date,
                }
                if movie
                else None
            )

            session_data = {
                "movie": movie_data,
                "translator_id": sess.translator_id,
                "season_id": sess.season_id,
                "episode_id": sess.episode_id,
            }

            return {"live_session": session_data}

    async def broadcast_to_user(self, user_id: int):
        payload = await self._get_session_payload(user_id)

        conns = self.active_connections.get(user_id, [])
        if not conns:
            return

        dead: List[WebSocket] = []

        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception as e:
                # сокет мертвий – позначаємо на видалення
                print(f"[WS MANAGER] send_json error for user {user_id}: {e}")
                dead.append(ws)

        # прибираємо всі "мертві" конекти
        for ws in dead:
            if ws in conns:
                conns.remove(ws)
        if not conns:
            self.active_connections.pop(user_id, None)


ws_manager = WebSocketManager()
