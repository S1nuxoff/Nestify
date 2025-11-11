from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


from sqlalchemy.orm import relationship


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    movie_id: Mapped[str] = mapped_column(
        String, ForeignKey("movies.id"), nullable=False
    )
    translator_id: Mapped[int] = mapped_column(Integer, nullable=True)
    season_id: Mapped[int] = mapped_column(Integer, nullable=True)
    episode_id: Mapped[int] = mapped_column(Integer, nullable=True)

    user = relationship("User", back_populates="sessions")
    movie = relationship("Movie", back_populates="sessions")
