from sqlalchemy import select
from app.models.watch_history import WatchHistory
from app.models.movies import Movie
from app.db.session import async_session

_HISTORY_LIMIT = 50


async def get_watch_history(user_id: int, deduplicate: bool = True):
    async with async_session() as session:
        async with session.begin():
            q = (
                select(
                    WatchHistory.movie_id,
                    WatchHistory.updated_at,
                    WatchHistory.position_seconds,
                    WatchHistory.duration.label("watch_duration"),
                    WatchHistory.episode,
                    WatchHistory.season,
                    WatchHistory.translator_id,
                    Movie.title,
                    Movie.link,
                    Movie.origin_name,
                    Movie.release_date,
                    Movie.description,
                    Movie.action,
                    Movie.age,
                    Movie.trailer,
                    Movie.genre,
                    Movie.image,
                    Movie.country,
                    Movie.duration.label("movie_duration"),
                )
                .outerjoin(Movie, Movie.id == WatchHistory.movie_id)
                .where(WatchHistory.user_id == user_id)
                .order_by(WatchHistory.updated_at.desc())
            )
            if deduplicate:
                q = q.limit(_HISTORY_LIMIT)
            result = await session.execute(q)
            rows = result.all()
            if not rows:
                return None

            data = []
            seen_movies = set()

            for row in rows:
                if deduplicate:
                    if row.movie_id in seen_movies:
                        continue
                    seen_movies.add(row.movie_id)

                data.append(
                    {
                        "id": row.movie_id,
                        "title": row.title,
                        "link": row.link,
                        "origin_name": row.origin_name,
                        "release_date": row.release_date,
                        "description": row.description,
                        "action": row.action,
                        "updated_at": row.updated_at,
                        "age": row.age,
                        "trailer": row.trailer,
                        "genre": row.genre,
                        "image": row.image,
                        "country": row.country,
                        "duration": row.movie_duration,
                        "position": row.position_seconds,
                        "watch_duration": row.watch_duration,
                        "episode": row.episode,
                        "season": row.season,
                        "translator_id": row.translator_id,
                    }
                )

            return data
