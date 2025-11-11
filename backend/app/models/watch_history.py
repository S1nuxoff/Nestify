from sqlalchemy import Integer, String, DateTime, ForeignKey
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class WatchHistory(Base):
    __tablename__ = "watch_history"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, default=1
    )

    movie_id: Mapped[str] = mapped_column(
        ForeignKey("movies.id"),
        nullable=False,
    )

    translator_id: Mapped[str | None] = mapped_column(String, nullable=True)
    season: Mapped[int | None] = mapped_column(nullable=True)
    episode: Mapped[int | None] = mapped_column(nullable=True)

    # 🔥 НОВЕ ПОЛЕ — загальна тривалість фільму/епізоду в секундах
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)

    position_seconds: Mapped[int] = mapped_column(default=0)

    watched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
