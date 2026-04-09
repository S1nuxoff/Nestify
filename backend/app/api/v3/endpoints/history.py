from fastapi import APIRouter, Query
from sqlalchemy import select, desc

from app.db.session import async_session
from app.models.watch_history import WatchHistory
from app.schemas.torrent import ProgressResponse, ProgressSaveRequest, WatchHistoryItem
from app.services.media.watch_history import get_watch_position, update_watch_position

router = APIRouter()


@router.post("/progress", response_model=ProgressResponse, summary="Save watch progress")
async def save_progress(body: ProgressSaveRequest):
    await update_watch_position(
        user_id=body.user_id,
        movie_id=body.movie_id,
        position_seconds=body.position_seconds,
        season=body.season,
        episode=body.episode,
        duration=body.duration,
        torrent_hash=body.torrent_hash,
        torrent_file_id=body.torrent_file_id,
        torrent_fname=body.torrent_fname,
        torrent_magnet=body.torrent_magnet,
    )
    return {
        "position_seconds": body.position_seconds,
        "torrent_hash":     body.torrent_hash,
        "torrent_file_id":  body.torrent_file_id,
        "torrent_fname":    body.torrent_fname,
        "torrent_magnet":   body.torrent_magnet,
    }


@router.get("/progress", response_model=ProgressResponse, summary="Get watch progress")
async def get_progress(
    user_id: int = Query(...),
    movie_id: str = Query(...),
    season: int | None = Query(None),
    episode: int | None = Query(None),
):
    return await get_watch_position(
        user_id=user_id,
        movie_id=movie_id,
        season=season,
        episode=episode,
    )


@router.get("/history", response_model=list[WatchHistoryItem], summary="Get watch history")
async def get_history(
    user_id: int = Query(...),
    limit: int = Query(50, le=200),
):
    async with async_session() as session:
        stmt = (
            select(WatchHistory)
            .where(WatchHistory.user_id == user_id)
            .order_by(desc(WatchHistory.updated_at))
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()

    return [
        WatchHistoryItem(
            movie_id=r.movie_id,
            season=r.season,
            episode=r.episode,
            position_seconds=r.position_seconds or 0,
            duration=r.duration,
            watched_at=r.watched_at.isoformat() if r.watched_at else "",
            updated_at=r.updated_at.isoformat() if r.updated_at else "",
            torrent_hash=r.torrent_hash,
            torrent_file_id=r.torrent_file_id,
            torrent_fname=r.torrent_fname,
        )
        for r in rows
    ]
