# app/schemas/rezka.py

from __future__ import annotations

from datetime import datetime
from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field, field_validator


class Translator(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None


class SourceLink(BaseModel):
    quality: Optional[str] = None
    url: Optional[str] = None


class Source(BaseModel):
    translate_id: Optional[str] = None
    translate_name: Optional[str] = None
    source_links: List[SourceLink] = Field(default_factory=list)


class EpisodeSchedule(BaseModel):
    episode_number: int
    episode_id: str
    title: Optional[str] = None
    original_title: Optional[str] = None
    air_date: Optional[str] = None


class SeasonSchedule(BaseModel):
    season_number: int
    episodes: List[EpisodeSchedule] = Field(default_factory=list)


class GetSourceResponse(BaseModel):
    sources: List[Source] = Field(default_factory=list)


class WatchLastProgress(BaseModel):
    translator_id: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    duration: Optional[int] = None
    position_seconds: int = 0
    watched_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class LastWatch(BaseModel):
    translator_id: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    duration: Optional[int] = None
    position_seconds: int = 0
    watched_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Actor(BaseModel):
    id: Optional[str] = None
    pid: Optional[str] = None
    name: Optional[str] = None
    url: Optional[str] = None
    photo: Optional[str] = None
    job: Optional[str] = None
    itemprop: Optional[str] = None


class TmdbCast(BaseModel):
    tmdb_id: Optional[int] = None
    name: Optional[str] = None
    character: Optional[str] = None
    order: Optional[int] = None
    profile_url: Optional[str] = None
    profile_url_original: Optional[str] = None


class TmdbInfo(BaseModel):
    type: Optional[str] = None
    id: Optional[int] = None
    imdb_id: Optional[str] = None
    title: Optional[str] = None
    original_title: Optional[str] = None
    overview: Optional[str] = None
    tagline: Optional[str] = None
    release_date: Optional[str] = None
    runtime: Optional[int] = None
    number_of_seasons: Optional[int] = None
    number_of_episodes: Optional[int] = None
    status: Optional[str] = None
    homepage: Optional[str] = None
    popularity: Optional[float] = None
    vote_average: Optional[float] = None
    vote_count: Optional[int] = None

    genres: List[str] = Field(default_factory=list)
    production_countries: List[str] = Field(default_factory=list)
    spoken_languages: List[str] = Field(default_factory=list)

    poster_url: Optional[str] = None
    poster_url_original: Optional[str] = None
    backdrop_url: Optional[str] = None
    backdrop_url_original: Optional[str] = None

    trailer_youtube: Optional[str] = None
    cast: List[TmdbCast] = Field(default_factory=list)


class Rezka(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    origin_name: Optional[str] = None
    image: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    rate: Optional[str] = None

    translator_ids: List[Translator] = Field(default_factory=list)
    trailer: Optional[str] = None
    link: Optional[str] = None
    action: Optional[str] = None
    favs: Optional[str] = None

    season_ids: List[str] = Field(default_factory=list)
    episodes_schedule: List[SeasonSchedule] = Field(default_factory=list)

    release_date: Optional[str] = None
    country: Optional[str] = None
    genre: List[str] = Field(default_factory=list)
    director: List[str] = Field(default_factory=list)
    age: Optional[str] = None
    actors: List[Actor] = Field(default_factory=list)
    imdb_id: Optional[str] = None

    tmdb: Optional[TmdbInfo] = None

    backdrop: Optional[str] = None
    logo_url: Optional[str] = None
    poster_tmdb: Optional[str] = None
    trailer_tmdb: Optional[str] = None

    cast_tmdb: List[TmdbCast] = Field(default_factory=list)

    watch_history: List[LastWatch] = Field(default_factory=list)
    last_watch: Optional[LastWatch] = None

    # --- FIX: БД может отдавать NULL, а API должен отдавать [] ---
    @field_validator(
        "actors",
        "cast_tmdb",
        "season_ids",
        "episodes_schedule",
        "translator_ids",
        mode="before",
    )
    @classmethod
    def _none_to_list(cls, v):
        return [] if v is None else v

    model_config = {"from_attributes": True}


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
