# app/services/session_service.py
from app.db.session import async_session
from app.models.sessions import Session as SessionModel
from sqlalchemy import select, delete
from app.websockets.manager import ws_manager


async def add_session(
    user_id, movie_id, translator_id=None, season_id=None, episode_id=None
):
    async with async_session() as session:
        async with session.begin():
            # Удаляем старую сессию этого пользователя
            await session.execute(
                delete(SessionModel).where(SessionModel.user_id == user_id)
            )
            # Создаём новую
            new_session = SessionModel(
                user_id=user_id,
                movie_id=movie_id,
                translator_id=translator_id,
                season_id=season_id,
                episode_id=episode_id,
            )
            session.add(new_session)
        await session.commit()
    # После коммита делаем broadcast!
    await ws_manager.broadcast_to_user(user_id)


async def remove_session(user_id):
    async with async_session() as session:
        async with session.begin():
            await session.execute(
                delete(SessionModel).where(SessionModel.user_id == user_id)
            )
        await session.commit()
    await ws_manager.broadcast_to_user(user_id)
