import asyncio
import aiohttp


from sqlalchemy import select, delete
from app.db.session import async_session
from app.models.featured import Featured
from app.services.rezka import get_search, get_movie

TMDB_API_KEY = "4ef0d7355d9ffb5151e987764708ce96"
TMDB_API_URL = "https://api.themoviedb.org/3"
HEADERS = {"Accept": "application/json"}


async def refresh_featured(limit: int = 10):
    """Очищает таблицу featured и добавляет новые фильмы из TMDb/HDRezka."""
    async with async_session() as db_session:
        async with db_session.begin():
            await db_session.execute(delete(Featured))
            print("🗑️ Таблица featured очищена")

    async with aiohttp.ClientSession() as http_session:
        url = (
            f"{TMDB_API_URL}/trending/movie/week?api_key={TMDB_API_KEY}&language=en-US"
        )
        try:
            async with http_session.get(url, headers=HEADERS) as response:
                response.raise_for_status()
                data = await response.json()
                movies = data.get("results", [])[:limit]
        except Exception as e:

            return

    for movie in movies:
        title_en = movie.get("title")

        try:
            search_results = await get_search(title_en)
        except Exception as e:
            continue

        if not search_results["results"]:
            continue

        best_match = search_results["results"][0]

        try:
            details = await get_movie(best_match["filmLink"])
            if not details.get("translator_ids"):
                continue
        except Exception as e:
            continue

        # 👉 беремо backdrop з TMDB
        backdrop_path = movie.get("backdrop_path")
        # повний URL до зображення (можеш змінити розмір: w300, w780, w1280, original)
        tmdb_backdrop_url = (
            f"https://image.tmdb.org/t/p/w1280{backdrop_path}"
            if backdrop_path
            else details.get("image")  # fallback на rezka, якщо раптом немає backdrop
        )

        try:
            async with async_session() as session:
                async with session.begin():
                    new_featured = Featured(
                        id=details["id"],
                        title=details["title"],
                        origin_name=details.get("origin_name"),
                        image=tmdb_backdrop_url,  # 👈 ТУТ вже лінк з TMDB
                        duration=details.get("duration"),
                        description=details.get("description"),
                        rate=details.get("rate"),
                        genre=details.get("genre"),
                        country=details.get("country"),
                        director=details.get("director"),
                        age=details.get("age"),
                        link=details["link"],
                        action=details.get("action"),
                        favs=details.get("favs"),
                        trailer=details.get("trailer"),
                        translator_ids=details.get("translator_ids"),
                        season_ids=details.get("season_ids", []),
                        episodes_schedule=details.get("episodes_schedule", []),
                        release_date=details.get("release_date"),
                        imdb_id=details.get("imdb_id"),
                    )
                    session.add(new_featured)
                    print(f"✅ Сохранено в БД: {details['title']}")
        except Exception as e:
            print(f"❌ Ошибка при сохранении в БД: {e}")


async def get_all_featured():
    async with async_session() as session:
        result = await session.execute(select(Featured))
        return result.scalars().all()
