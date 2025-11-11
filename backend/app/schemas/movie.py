from pydantic import BaseModel
from typing import Optional, List


class MovieBase(BaseModel):
    id: str
    title: str
    origin_name: Optional[str]
    image: Optional[str]
    duration: Optional[int]
    description: Optional[str]
    rate: Optional[str]
    genre: Optional[List[str]]
    country: Optional[str]
    director: Optional[List[str]]
    age: Optional[str]
    link: str
    action: Optional[str]
    favs: Optional[str]
    trailer: Optional[str]
    translator_ids: Optional[List[dict]]
    season_ids: Optional[List[str]]
    episodes_schedule: Optional[List[dict]]
    release_date: Optional[str]


class MovieCreate(MovieBase):
    pass


class MovieOut(MovieBase):
    class Config:
        from_attributes = True
