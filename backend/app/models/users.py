from sqlalchemy import Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.models.base import Base
import enum

from sqlalchemy.orm import relationship
class UserRole(enum.Enum):
    admin = "admin"
    user = "user"
    guest = "guest"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    kodi_address: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Замість кольору — посилання на аватар
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    sessions = relationship("Session", back_populates="user")