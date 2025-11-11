from sqlalchemy import select
from app.models.watch_history import WatchHistory
from app.models.movies import Movie
from app.db.session import async_session


async def get_watch_history(user_id: int):
    async with async_session() as session:
        async with session.begin():
            # 1) берём все записи по юзеру, самые свежие идут первыми
            result = await session.execute(
                select(WatchHistory)
                .where(WatchHistory.user_id == user_id)
                .order_by(WatchHistory.updated_at.desc())
            )
            rows = result.scalars().all()
            if not rows:
                return None

            data = []
            seen_movies = set()  # сюда складываем movie_id, которые уже добавили

            for item in rows:
                # пропускаем, если такой фильм уже попал в выдачу
                if item.movie_id in seen_movies:
                    continue

                # 2) берём сам фильм
                movie_row = await session.execute(
                    select(Movie).where(Movie.id == item.movie_id)
                )
                movie = movie_row.scalars().first()
                if not movie:
                    continue

                # 3) кладём в результат и помечаем как «уже есть»
                data.append(
                    {
                        "id": item.movie_id,
                        "title": movie.title,
                        "link": movie.link,
                        "origin_name": movie.origin_name,
                        "release_date": movie.release_date,
                        "description": movie.description,
                        "action": movie.action,
                        "updated_at": item.updated_at,
                        "age": movie.age,
                        "trailer": movie.trailer,
                        "genre": movie.genre,
                        "image": movie.image,
                        "country": movie.country,
                        "duration": movie.duration,
                        "position": item.position_seconds,
                        "episode": item.episode,
                        "season": item.season,
                        "translator_id": item.translator_id,
                    }
                )
                seen_movies.add(item.movie_id)

            return data
