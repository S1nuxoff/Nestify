from pydantic import BaseModel
from typing import Optional


class PlayRequest(BaseModel):
    movie_id: str
    translator_id: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    position_seconds: Optional[int] = 0
