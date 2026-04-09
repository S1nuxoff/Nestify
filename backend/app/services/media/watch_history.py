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
    duration: int | None = None,
    torrent_hash: str | None = None,
    torrent_file_id: int | None = None,
    torrent_fname: str | None = None,
    torrent_magnet: str | None = None,
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
            if torrent_hash is not None:
                row.torrent_hash    = torrent_hash
                row.torrent_file_id = torrent_file_id
                row.torrent_fname   = torrent_fname
                row.torrent_magnet  = torrent_magnet
            return row

        if not create_if_absent:
            return None

        row = WatchHistory(
            user_id=user_id,
            movie_id=movie_id,
            season=season,
            episode=episode,
            position_seconds=position_seconds,
            duration=duration,
            torrent_hash=torrent_hash,
            torrent_file_id=torrent_file_id,
            torrent_fname=torrent_fname,
            torrent_magnet=torrent_magnet,
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
) -> dict:
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
        if not row:
            return {"position_seconds": 0}
        return {
            "position_seconds": row.position_seconds or 0,
            "torrent_hash":     row.torrent_hash,
            "torrent_file_id":  row.torrent_file_id,
            "torrent_fname":    row.torrent_fname,
            "torrent_magnet":   row.torrent_magnet,
        }


async def get_all_watches_for_movie(user_id: int, movie_id: str) -> list[WatchHistory]:
    async with async_session() as session, session.begin():
        stmt = (
            select(WatchHistory)
            .where(WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id)
            .order_by(desc(WatchHistory.updated_at), desc(WatchHistory.watched_at))
        )
        return list((await session.execute(stmt)).scalars().all())


async def get_last_watch_for_movie(user_id: int, movie_id: str) -> WatchHistory | None:
    async with async_session() as session, session.begin():
        stmt = (
            select(WatchHistory)
            .where(WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id)
            .order_by(desc(WatchHistory.updated_at), desc(WatchHistory.watched_at))
            .limit(1)
        )
        return (await session.execute(stmt)).scalars().first()
