from datetime import datetime
from sqlalchemy import select, and_, desc
from app.db.session import async_session
from app.models.watch_history import WatchHistory


async def update_watch_position(
    user_id: int,
    movie_id: str,
    position_seconds: int,
    *,
    season: int | None = None,
    episode: int | None = None,
    duration: int | None = None,  # 🔥 новий аргумент
    create_if_absent: bool = True,
) -> WatchHistory | None:
    async with async_session() as session, session.begin():
        cond = [
            WatchHistory.user_id == user_id,
            WatchHistory.movie_id == movie_id,
        ]
        if season is not None:
            cond.append(WatchHistory.season == season)
            cond.append(WatchHistory.episode == episode)

        row = (
            (await session.execute(select(WatchHistory).where(and_(*cond))))
            .scalars()
            .first()
        )

        if row:
            row.position_seconds = position_seconds
            row.updated_at = datetime.utcnow()
            if duration is not None:
                row.duration = duration
            return row

        if not create_if_absent:
            return None

        # створюємо новий запис
        row = WatchHistory(
            user_id=user_id,
            movie_id=movie_id,
            season=season,
            episode=episode,
            position_seconds=position_seconds,
            duration=duration,
            watched_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(row)
        return row


async def get_watch_position(
    user_id: int,
    movie_id: str,
    season: int | None = None,
    episode: int | None = None,
):
    async with async_session() as session, session.begin():
        cond = [
            WatchHistory.user_id == user_id,
            WatchHistory.movie_id == movie_id,
        ]
        if season is not None:
            cond.append(WatchHistory.season == season)
            cond.append(WatchHistory.episode == episode)

        row = (
            (await session.execute(select(WatchHistory).where(and_(*cond))))
            .scalars()
            .first()
        )
        return row.position_seconds if row else 0


async def get_all_watches_for_movie(
    user_id: int,
    movie_id: str,
) -> list[WatchHistory]:
    """
    Все записи watch_history для (user_id, movie_id),
    отсортированы по времени (последние сверху).
    """
    async with async_session() as session, session.begin():
        stmt = (
            select(WatchHistory)
            .where(
                WatchHistory.user_id == user_id,
                WatchHistory.movie_id == movie_id,
            )
            .order_by(
                desc(WatchHistory.updated_at),
                desc(WatchHistory.watched_at),
            )
        )
        rows = (await session.execute(stmt)).scalars().all()
        return list(rows)


async def get_last_watch_for_movie(
    user_id: int,
    movie_id: str,
) -> WatchHistory | None:
    """
    Оставляем и отдельную функцию last, если вдруг пригодится где-то ещё.
    """
    async with async_session() as session, session.begin():
        stmt = (
            select(WatchHistory)
            .where(
                WatchHistory.user_id == user_id,
                WatchHistory.movie_id == movie_id,
            )
            .order_by(
                desc(WatchHistory.updated_at),
                desc(WatchHistory.watched_at),
            )
            .limit(1)
        )
        row = (await session.execute(stmt)).scalars().first()
        return row
