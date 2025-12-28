# app/models/movies.py

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    origin_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image: Mapped[str | None] = mapped_column(Text, nullable=True)

    # было String(10) — часто мало (например "108 мин." / "1h 45m" и т.п.)
    duration: Mapped[str | None] = mapped_column(String(32), nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # было String(10) — рейтинг иногда длиннее/с символами
    rate: Mapped[str | None] = mapped_column(String(32), nullable=True)

    genre: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    country: Mapped[str | None] = mapped_column(Text, nullable=True)
    director: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # было String(10) — иногда "18+" / "0+" ок, но пусть будет чуть шире
    age: Mapped[str | None] = mapped_column(String(32), nullable=True)

    link: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)
    favs: Mapped[str | None] = mapped_column(String(50), nullable=True)
    trailer: Mapped[str | None] = mapped_column(Text, nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(Text, nullable=True)

    translator_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    season_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    episodes_schedule: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    release_date: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ✅ rezka actors
    actors: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # ✅ tmdb urls
    backdrop: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    poster_tmdb: Mapped[str | None] = mapped_column(Text, nullable=True)
    trailer_tmdb: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ✅ опционально: хранить весь tmdb-пакет (удобно для расширения без ALTER TABLE)
    tmdb: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # ✅ опционально: каст tmdb отдельно (если нужно быстро отдавать без вытаскивания из tmdb)
    cast_tmdb: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    sessions = relationship("Session", back_populates="movie")
