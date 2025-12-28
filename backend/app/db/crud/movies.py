from sqlalchemy import select
from app.db.session import async_session
from app.models.movies import Movie


UPDATABLE_FIELDS = [
    "title",
    "origin_name",
    "image",
    "duration",
    "description",
    "rate",
    "genre",
    "country",
    "director",
    "age",
    "link",
    "action",
    "favs",
    "trailer",
    "imdb_id",
    "translator_ids",
    "season_ids",
    "episodes_schedule",
    "release_date",
    "actors",
    "backdrop",
    "logo_url",
    "poster_tmdb",
    "trailer_tmdb",
    "tmdb",
    "cast_tmdb",
]


def _should_update_value(value) -> bool:
    """
    Чтобы не затирать поля пустыми значениями.
    - None / "" / [] / {} не пишем поверх существующего
    - но 0 и False (если вдруг) можно писать
    """
    if value is None:
        return False
    if isinstance(value, str) and value.strip() == "":
        return False
    if isinstance(value, (list, dict)) and len(value) == 0:
        return False
    return True


async def add_or_update_movie(movie: dict) -> Movie:
    if not movie or not movie.get("id"):
        raise ValueError("movie dict must contain non-empty 'id'")

    async with async_session() as session:
        res = await session.execute(select(Movie).where(Movie.id == movie["id"]))
        obj = res.scalars().first()

        if not obj:
            obj = Movie(
                id=movie["id"],
                title=movie.get("title") or "",
                link=movie.get("link") or "",
            )
            session.add(obj)

        for key in UPDATABLE_FIELDS:
            if key not in movie:
                continue

            val = movie.get(key)

            # если хочешь всегда обновлять даже пустыми — убери эту проверку
            if not _should_update_value(val):
                continue

            setattr(obj, key, val)

        await session.commit()
        await session.refresh(obj)
        return obj
