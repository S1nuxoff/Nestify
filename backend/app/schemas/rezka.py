from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class Translator(BaseModel):
    id: Optional[str]
    name: Optional[str]


class SourceLink(BaseModel):
    quality: Optional[str]
    url: Optional[str]


class Source(BaseModel):
    translate_id: Optional[str]
    translate_name: Optional[str]
    source_links: List[SourceLink] = []


class EpisodeSchedule(BaseModel):
    episode_number: int
    episode_id: str
    title: Optional[str] = None
    original_title: Optional[str] = None
    air_date: Optional[str] = None


class SeasonSchedule(BaseModel):
    season_number: int
    episodes: List[EpisodeSchedule] = []


class GetSourceResponse(BaseModel):
    sources: List[Source]


class WatchLastProgress(BaseModel):
    translator_id: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    duration: Optional[int] = None
    position_seconds: int
    watched_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# 👇 НОВОЕ: last_watch объект, который будем слать клиенту
class LastWatch(BaseModel):
    translator_id: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    duration: Optional[int] = None  # сек, общая длина
    position_seconds: int = 0  # где остановились
    watched_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Rezka(BaseModel):
    id: Optional[str]
    title: Optional[str]
    origin_name: Optional[str]
    image: Optional[str]
    duration: Optional[str]
    description: Optional[str]
    rate: Optional[str]
    translator_ids: List[Translator] = []
    trailer: Optional[str]
    link: Optional[str]
    action: Optional[str]
    favs: Optional[str]
    season_ids: List[str] = []
    episodes_schedule: List[SeasonSchedule] = []

    # Новые поля (из инфо-таблицы):
    release_date: Optional[str] = None
    country: Optional[str] = None
    genre: List[str] = []
    director: List[str] = []
    age: Optional[str] = None
    imdb_id: Optional[str] = None

    # 👇 НОВОЕ:
    # все просмотры пользователя по этому фильму/сериалу
    watch_history: List[LastWatch] = []
    # последняя запись (для удобства)
    last_watch: Optional[LastWatch] = None

    class Config:
        from_attributes = True


class FilmCard(BaseModel):
    filmLink: str
    filmImage: str
    filmName: str
    filmDecribe: str
    type: str
    filmId: str


class PageResponse(BaseModel):
    pages_count: int
    items: List[FilmCard]
    title: str


class WatchHistoryItem(BaseModel):
    movie_id: str
    translator_id: str
    action: str
    season: str
    episode: str
    position_seconds: str


class SearchResponse(BaseModel):
    results: List[FilmCard]


class FilmPoster(BaseModel):
    filmPosterUrl: str


class FilmInfo(BaseModel):
    film_image: str
    action: str
    duration: str
    film_id: str
    name_film: str
    name_origin_film: str
    translator_ids: List[Dict[str, Any]]
    translatorName: List[Any]
    season_ids: List[str]
    episodes: List[Dict[str, Any]]
    film_rate: str
    film_description: str
    trailer: str
    favs: str


class SubCategory(BaseModel):
    title: str
    url: str


class Category(BaseModel):
    title: str
    url: str
    subcategories: List[SubCategory]


class TopNavCategoriesResponse(BaseModel):
    categories: List[Category]


class MovieHistoryCreate(BaseModel):
    movie_id: int
    translator_id: int
    action: str
    season: Optional[int] = None
    episode: Optional[int] = None
