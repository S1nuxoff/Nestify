from sqlalchemy import Integer, String, DateTime, ForeignKey, Index
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class WatchHistory(Base):
    __tablename__ = "watch_history"
    __table_args__ = (
        Index("ix_wh_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, default=1
    )

    movie_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    translator_id: Mapped[str | None] = mapped_column(String, nullable=True)
    season: Mapped[int | None] = mapped_column(nullable=True)
    episode: Mapped[int | None] = mapped_column(nullable=True)

    # Торент-специфічні поля (для відновлення перегляду)
    torrent_hash:   Mapped[str | None] = mapped_column(String, nullable=True)
    torrent_file_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    torrent_fname:  Mapped[str | None] = mapped_column(String, nullable=True)
    torrent_magnet: Mapped[str | None] = mapped_column(String, nullable=True)

    # 🔥 НОВЕ ПОЛЕ — загальна тривалість фільму/епізоду в секундах
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)

    position_seconds: Mapped[int] = mapped_column(default=0)

    watched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
