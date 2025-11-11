import asyncio
from sqlalchemy import select, update
from app.models.movies import Movie
from app.db.session import async_session
from app.utils.utils import check_video_exists


async def updateTrailers():
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(select(Movie))
            movies = result.scalars().all()

            for item in movies:
                movie_trailer = item.trailer

                # Пропускаем, если трейлер пустой
                if not movie_trailer:
                    continue

                result = check_video_exists(movie_trailer)

                if result is None:
                    await session.execute(
                        update(Movie).where(Movie.id == item.id).values(trailer=None)
                    )
                    print(f"❌ Трейлер для фильма {item.id} недоступен → удалён")

                await asyncio.sleep(1)

            await session.commit()
        print("✅ Обновление трейлеров завершено.")


if __name__ == "__main__":
    asyncio.run(updateTrailers())
