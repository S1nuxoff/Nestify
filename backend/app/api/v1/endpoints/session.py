# app/api/v1/endpoints/session.py
from fastapi import APIRouter, Query
from app.services.session.session_service import add_session, remove_session

router = APIRouter()


@router.post("/add")
async def set_live_session(data: dict, user_id: int = Query(...)):
    await add_session(
        user_id=user_id,
        movie_id=data["movie_id"],
        translator_id=data.get("translator_id"),
        season_id=data.get("season_id"),
        episode_id=data.get("episode_id"),
    )
    return {"status": "ok"}


@router.post("/remove")
async def remove_live_session(user_id: int = Query(...)):
    await remove_session(user_id)
    return {"status": "ok"}
