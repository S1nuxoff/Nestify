from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LikedMovie(Base):
    __tablename__ = "liked_movies"
    __table_args__ = (
        UniqueConstraint("user_id", "link", name="uq_liked_movies_user_link"),
        Index("ix_liked_movies_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    movie_id: Mapped[str | None] = mapped_column(String, nullable=True)
    link: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    origin_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    release_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
