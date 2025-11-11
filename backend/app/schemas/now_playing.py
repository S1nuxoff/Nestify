from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NowPlayingBase(BaseModel):
    movie_id: str
    translator_id: Optional[str]
    season: Optional[int]
    episode: Optional[int]
    position_seconds: Optional[int] = 0


class NowPlayingCreate(NowPlayingBase):
    pass


class NowPlayingOut(NowPlayingBase):
    id: int
    started_at: datetime

    class Config:
        from_attributes = True
