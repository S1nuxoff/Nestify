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
    date_str = movie.get("release_date")
    if not date_str:
        return None
    try:
        return int(str(date_str)[:4])
    except ValueError:
        return None


def extract_rezka_year(details: dict) -> int | None:
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


def normalize_title(title: str | None) -> str:
    if not title:
        return ""
    cleaned = " ".join(title.split())
    return cleaned.lower()


async def fetch_tmdb_trending_movies(
    http_session: aiohttp.ClientSession,
    *,
    language: str = "uk",
    page: int = 1,
) -> dict:
    url = (
        f"{TMDB_API_URL}/trending/movie/week"
        f"?api_key={TMDB_API_KEY}&language={language}&page={page}"
    )
    async with http_session.get(url, headers=HEADERS) as response:
        response.raise_for_status()
        return await response.json()


async def refresh_featured(
    limit: int = 100, language: str = "uk", max_pages: int | None = None
):
    """
    Обновляет featured:
    - чистит таблицу
    - ходит по страницам TMDB trending
    - для каждого TMDB фильма ищет матч на Rezka
    - сохраняет до тех пор, пока не наберём `limit` успешных сохранений
    """

    # 1) чистим таблицу
    async with async_session() as db_session:
        async with db_session.begin():
            await db_session.execute(delete(Featured))
            print("🗑️ Таблица featured очищена")

    saved = 0
    tried = 0

    async with aiohttp.ClientSession() as http_session:
        # 2) сначала узнаем total_pages с первой страницы
        try:
            first = await fetch_tmdb_trending_movies(
                http_session, language=language, page=1
            )
        except Exception as e:
            print(f"❌ Ошибка запроса TMDB (page=1): {e}")
            return

        total_pages = int(first.get("total_pages") or 1)
        if max_pages is not None:
            total_pages = min(total_pages, max_pages)

        # соберём все страницы в список (первая уже есть)
        pages_data = [first]

        # можно последовательно (надёжнее) или параллельно (быстрее)
        # сделаю аккуратно параллельно, но с ограничением
        sem = asyncio.Semaphore(5)

        async def load_page(p: int):
            async with sem:
                return await fetch_tmdb_trending_movies(
                    http_session, language=language, page=p
                )

        # грузим страницы 2..total_pages
        if total_pages >= 2:
            try:
                rest = await asyncio.gather(
                    *(load_page(p) for p in range(2, total_pages + 1))
                )
                pages_data.extend(rest)
            except Exception as e:
                print(f"⚠️ Не удалось загрузить все страницы TMDB: {e}")
                # продолжаем с тем что есть

    # 3) объединяем фильмы со всех страниц в один список
    tmdb_movies: list[dict] = []
    for pd in pages_data:
        tmdb_movies.extend(pd.get("results", []) or [])

    print(
        f"🎬 Получено из TMDB: {len(tmdb_movies)} фильмов (страниц: {len(pages_data)})"
    )

    # 4) перебираем и сохраняем, пока не наберём limit
    for movie in tmdb_movies:
        if saved >= limit:
            break

        tmdb_title = (movie.get("title") or "").strip()
        tmdb_year = extract_tmdb_year(movie)
        if not tmdb_title:
            continue

        tried += 1

        # Rezka search
        try:
            search_results = await get_search(tmdb_title)
        except Exception as e:
            print(f"❌ Ошибка get_search('{tmdb_title}'): {e}")
            continue

        candidates = search_results.get("results") or []
        if not candidates:
            continue

        details = None
        norm_tmdb_title = normalize_title(tmdb_title)

        for candidate in candidates:
            film_link = candidate.get("filmLink")
            if not film_link:
                continue

            try:
                candidate_details = await get_movie(film_link)
            except Exception:
                continue

            # нужны озвучки
            if not candidate_details.get("translator_ids"):
                continue

            rezka_year = extract_rezka_year(candidate_details)
            rezka_title = (candidate_details.get("title") or "").strip()
            norm_rezka_title = normalize_title(rezka_title)

            # год: если оба есть и не совпадают — мимо
            if (
                tmdb_year is not None
                and rezka_year is not None
                and tmdb_year != rezka_year
            ):
                continue

            # title: у тебя было строго ==, оставлю так же (как сейчас)
            # но имей в виду: это главная причина почему сохраняется мало
            if (
                norm_tmdb_title
                and norm_rezka_title
                and norm_tmdb_title != norm_rezka_title
            ):
                continue

            details = candidate_details
            break

        if not details:
            continue

        backdrop_path = movie.get("backdrop_path")
        tmdb_backdrop_url = (
            f"https://image.tmdb.org/t/p/original{backdrop_path}"
            if backdrop_path
            else details.get("image")
        )

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

            saved += 1
            print(
                f"✅ [{saved}/{limit}] {details['title']} (TMDB title='{tmdb_title}', year={tmdb_year})"
            )

        except Exception as e:
            print(f"❌ Ошибка при сохранении в БД: {e}")

    print(f"🏁 Готово. Попыток: {tried}, сохранено: {saved}/{limit}")


async def get_all_featured():
    async with async_session() as session:
        result = await session.execute(select(Featured))
        return result.scalars().all()
