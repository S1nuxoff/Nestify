import asyncio
import aiohttp
import re


from sqlalchemy import select, delete
from app.db.session import async_session
from app.models.featured import Featured
from app.services.rezka import get_search, get_movie

TMDB_API_KEY = "4ef0d7355d9ffb5151e987764708ce96"
TMDB_API_URL = "https://api.themoviedb.org/3"
HEADERS = {"Accept": "application/json"}


def extract_tmdb_year(movie: dict) -> int | None:
    """
    TMDB: "release_date": "2025-10-17"
    → вернёт 2025
    """
    date_str = movie.get("release_date")
    if not date_str:
        return None
    try:
        return int(str(date_str)[:4])
    except ValueError:
        return None


def extract_rezka_year(details: dict) -> int | None:
    """
    HDRezka: может быть "8 сентября 2025 года", "2025", "2025 г." и т.п.
    Берём любую 4-значную годовую цифру.
    """
    raw = details.get("release_date") or details.get("year")
    if raw is None:
        return None

    if isinstance(raw, int):
        return raw

    if isinstance(raw, str):
        m = re.search(r"(\d{4})", raw)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                return None

    return None


async def refresh_featured(limit: int = 10):
    """Очищает таблицу featured и добавляет новые фильмы из TMDb/HDRezka с проверкой года."""
    # 1) чистим таблицу
    async with async_session() as db_session:
        async with db_session.begin():
            await db_session.execute(delete(Featured))
            print("🗑️ Таблица featured очищена")

    # 2) берём трендовые фильмы с TMDB
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
            print(f"❌ Ошибка запроса TMDB: {e}")
            return

    # 3) пробегаемся по фильмам TMDB
    for movie in movies:
        title_en = movie.get("title")
        tmdb_year = extract_tmdb_year(movie)

        if not title_en:
            continue

        try:
            search_results = await get_search(title_en)
        except Exception as e:
            print(f"❌ Ошибка get_search('{title_en}'): {e}")
            continue

        candidates = search_results.get("results") or []
        if not candidates:
            print(f"⚠️ Не найдено результатов на HDRezka для: {title_en}")
            continue

        # 👉 пытаемся найти лучший матч по году
        details = None
        for candidate in candidates:
            film_link = candidate.get("filmLink")
            if not film_link:
                continue

            try:
                candidate_details = await get_movie(film_link)
            except Exception as e:
                print(f"⚠️ Ошибка get_movie({film_link}): {e}")
                continue

            # без переводов нам не интересно
            if not candidate_details.get("translator_ids"):
                continue

            rezka_year = extract_rezka_year(candidate_details)

            # если оба года известны и НЕ совпадают — пропускаем
            if (
                tmdb_year is not None
                and rezka_year is not None
                and tmdb_year != rezka_year
            ):
                print(
                    f"↩️ Мисматч по году для '{title_en}': TMDB={tmdb_year}, Rezka={rezka_year}, пропускаем этот результат"
                )
                continue

            # если дошли сюда — это подходящий матч
            details = candidate_details
            break

        # если так и не нашли нормальный матч — скип
        if not details:
            print(f"⚠️ Не найден подходящий матч по году для: {title_en}")
            continue

        # 4) фон / постер
        backdrop_path = movie.get("backdrop_path")
        tmdb_backdrop_url = (
            f"https://image.tmdb.org/t/p/w1280{backdrop_path}"
            if backdrop_path
            else details.get("image")
        )

        # 5) сохраняем в БД
        try:
            async with async_session() as session:
                async with session.begin():
                    new_featured = Featured(
                        id=details["id"],
                        title=details["title"],
                        origin_name=details.get("origin_name"),
                        image=tmdb_backdrop_url,
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
                    print(f"✅ Сохранено в БД: {details['title']} ({tmdb_year})")
        except Exception as e:
            print(f"❌ Ошибка при сохранении в БД: {e}")


async def get_all_featured():
    async with async_session() as session:
        result = await session.execute(select(Featured))
        return result.scalars().all()
