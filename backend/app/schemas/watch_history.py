from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class WatchHistoryBase(BaseModel):
    movie_id: str
    translator_id: Optional[str]
    season: Optional[int]
    episode: Optional[int]
    position_seconds: Optional[int] = 0


class WatchHistoryCreate(WatchHistoryBase):
    pass


class WatchHistoryOut(WatchHistoryBase):
    id: int
    last_watched_at: datetime

    class Config:
        from_attributes = True


class MovieHistoryCreate(BaseModel):
    movie_id: int
    translator_id: int
    action: str
    season: Optional[int] = None
    episode: Optional[int] = None
    position_seconds: int
