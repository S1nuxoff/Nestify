from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.v1.endpoints.auth import get_current_account
from app.models.accounts import Account
from app.plugins.playback import PlaybackStore

router = APIRouter()

_store = PlaybackStore()


def get_playback_store() -> PlaybackStore:
    return _store


async def _require_own_profile(store: PlaybackStore, account: Account, user_id: int) -> None:
    if not await store.owns(account.id, user_id):
        raise HTTPException(403, "this profile belongs to another account")


class VoiceRequest(BaseModel):
    user_id: int
    movie_id: str = Field(min_length=1, max_length=120)
    voice: str = Field(min_length=1, max_length=255)
    explicit: bool = False


@router.get("/playback")
async def playback_state(
    user_id: int = Query(...),
    movie_id: str = Query(..., min_length=1, max_length=120),
    account: Account = Depends(get_current_account),
    store: PlaybackStore = Depends(get_playback_store),
):
    await _require_own_profile(store, account, user_id)
    return await store.state(user_id, movie_id)


@router.put("/playback/voice", status_code=204)
async def save_voice(
    body: VoiceRequest,
    account: Account = Depends(get_current_account),
    store: PlaybackStore = Depends(get_playback_store),
):
    await _require_own_profile(store, account, body.user_id)
    await store.save_voice(body.user_id, body.movie_id, body.voice, body.explicit)
