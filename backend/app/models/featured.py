from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Featured(Base):
    __tablename__ = "featured"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # film_id з rezka

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    origin_name: Mapped[str] = mapped_column(String(255), nullable=True)

    # Картинка для карточки (обычно backdrop TMDB, иначе rezka image)
    image: Mapped[str] = mapped_column(Text, nullable=True)

    duration: Mapped[str] = mapped_column(String(10), nullable=True)  # у секундах!
    description: Mapped[str] = mapped_column(Text, nullable=True)
    rate: Mapped[str] = mapped_column(String(10), nullable=True)

    genre: Mapped[list] = mapped_column(JSON, nullable=True)
    country: Mapped[str] = mapped_column(Text, nullable=True)
    director: Mapped[list] = mapped_column(JSON, nullable=True)
    age: Mapped[str] = mapped_column(String(10), nullable=True)

    link: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=True)
    favs: Mapped[str] = mapped_column(String(50), nullable=True)

    trailer: Mapped[str] = mapped_column(Text, nullable=True)
    imdb_id: Mapped[str] = mapped_column(Text, nullable=True)

    translator_ids: Mapped[list] = mapped_column(JSON, nullable=True)
    season_ids: Mapped[list] = mapped_column(JSON, nullable=True)
    episodes_schedule: Mapped[list] = mapped_column(JSON, nullable=True)

    release_date: Mapped[str] = mapped_column(String(50), nullable=True)

    # ✅ NEW: нужно сохранять эти поля
    actors: Mapped[list] = mapped_column(JSON, nullable=True)

    backdrop: Mapped[str] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str] = mapped_column(Text, nullable=True)
    poster_tmdb: Mapped[str] = mapped_column(Text, nullable=True)
    trailer_tmdb: Mapped[str] = mapped_column(Text, nullable=True)
