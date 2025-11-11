from sqlalchemy import Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class NowPlaying(Base):
    __tablename__ = "now_playing"

    id: Mapped[int] = mapped_column(primary_key=True)
    movie_id: Mapped[str] = mapped_column(ForeignKey("movies.id"), nullable=False)
    translator_id: Mapped[str] = mapped_column(String, nullable=True)
    season: Mapped[int] = mapped_column(nullable=True)
    episode: Mapped[int] = mapped_column(nullable=True)
    position_seconds: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
