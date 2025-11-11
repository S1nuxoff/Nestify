from sqlalchemy import select
from app.models.movies import Movie
from app.db.session import async_session


async def get_movie_db(movie_id):
    async with async_session() as session:
        async with session.begin():
            query = select(Movie).where(Movie.id == movie_id)
            result = await session.execute(query)
            movie = result.scalars().first()
            if not movie:
                return None
            return movie
