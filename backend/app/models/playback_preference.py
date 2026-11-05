from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

ANY_TITLE = "*"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PlaybackPreference(Base):
    """The voice a profile uses, per title and overall (scope = ANY_TITLE)."""

    __tablename__ = "playback_preferences"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    scope: Mapped[str] = mapped_column(String(128), primary_key=True)
    voice: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
