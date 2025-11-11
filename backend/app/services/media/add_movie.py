from app.db.session import async_session
from sqlalchemy import select
from app.models.movies import Movie


async def add_movie(movie):
    async with async_session() as session:
        async with session.begin():
            existing_movie = await session.execute(
                select(Movie).where(Movie.id == movie["id"])
            )
            existing_movie = existing_movie.scalars().first()
            if existing_movie:
                return existing_movie

            new_movie = Movie(
                id=movie["id"],
                title=movie["title"],
                origin_name=movie.get("origin_name"),
                image=movie.get("image"),
                duration=movie.get("duration"),
                description=movie.get("description"),
                rate=movie.get("rate"),
                genre=movie.get("genre"),
                country=movie.get("country"),
                director=movie.get("director"),
                age=movie.get("age"),
                link=movie["link"],
                action=movie.get("action"),
                favs=movie.get("favs"),
                trailer=movie.get("trailer"),
                translator_ids=movie.get("translator_ids"),
                season_ids=movie.get("season_ids", []),
                episodes_schedule=movie.get("episodes_schedule", []),
                release_date=movie.get("release_date"),
            )
            session.add(new_movie)
            await session.commit()
            return new_movie
