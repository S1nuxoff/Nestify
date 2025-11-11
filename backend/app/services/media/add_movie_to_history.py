from datetime import datetime
from sqlalchemy import select, and_
from app.db.session import async_session
from app.models.watch_history import WatchHistory
from app.models.movies import Movie


async def add_movie_to_history(
    user_id: int,
    movie_id: str,
    translator_id: str | None,
    action: str,
    season: int | None,
    episode: int | None,
):
    """
    Создаёт (или освежает дату) записи в watch_history.
    position_seconds всегда 0 для новой записи и НЕ трогается,
    если строка уже существует.
    """

    async with async_session() as session, session.begin():
        # 1. фильм существует?
        movie = (
            (await session.execute(select(Movie).where(Movie.id == movie_id)))
            .scalars()
            .first()
        )
        if not movie:
            return None

        # 2. ищем существующую строку
        if action == "get_stream":
            query = select(WatchHistory).where(
                and_(
                    WatchHistory.user_id == user_id,
                    WatchHistory.movie_id == movie_id,
                    WatchHistory.season == season,
                    WatchHistory.episode == episode,
                )
            )
        else:  # get_movie
            query = select(WatchHistory).where(
                and_(
                    WatchHistory.user_id == user_id,
                    WatchHistory.movie_id == movie_id,
                )
            )

        existing = (await session.execute(query)).scalars().first()

        if existing:  # ── 3. запись уже есть
            existing.updated_at = datetime.utcnow()
            existing.translator_id = translator_id
            return existing

        if action == "get_movie":  # ── 4. новая запись
            season = None
            episode = None

        new_history = WatchHistory(
            user_id=user_id,
            movie_id=movie_id,
            translator_id=translator_id,
            season=season,
            episode=episode,
            position_seconds=0,  # ← всегда 0
            watched_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(new_history)
        return new_history
