from sqlalchemy import Integer, String, DateTime, Boolean, Enum, ForeignKey, UniqueConstraint
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
    __table_args__ = (
        UniqueConstraint("account_id", "name", name="uq_users_account_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    kodi_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_lang: Mapped[str] = mapped_column(String(10), nullable=False, default="best", server_default="best")

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

    account = relationship("Account", back_populates="profiles")
    sessions = relationship("Session", back_populates="user")
