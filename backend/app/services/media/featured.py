import re
from difflib import SequenceMatcher

import aiohttp
from sqlalchemy import select, delete

from app.db.session import async_session
from app.models.featured import Featured
from app.services.rezka import get_search, get_movie
from app.services.themoviedb import tmdb_by_imdb, tmdb_by_id

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
    cleaned = " ".join(title.split()).lower()
    cleaned = cleaned.replace("ё", "е")
    cleaned = re.sub(r"[^\w\s]", " ", cleaned, flags=re.UNICODE)
    cleaned = " ".join(cleaned.split())
    return cleaned


def title_similarity(a: str, b: str) -> float:
    na = normalize_title(a)
    nb = normalize_title(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


async def refresh_featured(limit: int = 10, *, min_title_similarity: float = 0.72):
    """
    Очищает таблицу featured и добавляет новые фильмы из TMDb/HDRezka.
    Матч: год + similarity по названию + наличие переводчиков.
    Enrich: TMDB по imdb_id (точно) или fallback по tmdb_id (из trending).
    """

    # 1) чистим таблицу
    async with async_session() as db_session:
        async with db_session.begin():
            await db_session.execute(delete(Featured))
            print("🗑️ Таблица featured очищена")

    # 2) берём трендовые фильмы с TMDB (РУССКИЙ)
    async with aiohttp.ClientSession() as http_session:
        url = f"{TMDB_API_URL}/trending/movie/week?api_key={TMDB_API_KEY}&language=ru"
        try:
            async with http_session.get(url, headers=HEADERS) as response:
                response.raise_for_status()
                data = await response.json()
                movies = (data.get("results", []) or [])[:limit]
        except Exception as e:
            print(f"❌ Ошибка запроса TMDB: {e}")
            return

    # 3) по каждому фильму
    for movie in movies:
        tmdb_id = movie.get("id")
        tmdb_title_ru = (movie.get("title") or "").strip()
        tmdb_year = extract_tmdb_year(movie)

        if not tmdb_title_ru:
            print("⚠️ У фильма из TMDB нет title, скипаем")
            continue

        # Поиск на Rezka
        try:
            search_results = await get_search(tmdb_title_ru)
        except Exception as e:
            print(f"❌ Ошибка get_search('{tmdb_title_ru}'): {e}")
            continue

        candidates = search_results.get("results") or []
        if not candidates:
            print(f"⚠️ Не найдено результатов на Rezka для: {tmdb_title_ru}")
            continue

        # Ищем лучший матч
        best_details = None
        best_sim = 0.0

        for candidate in candidates:
            film_link = candidate.get("filmLink")
            if not film_link:
                continue

            try:
                candidate_details = await get_movie(film_link)
            except Exception as e:
                print(f"⚠️ Ошибка get_movie({film_link}): {e}")
                continue

            # Без переводчиков пропускаем
            if not candidate_details.get("translator_ids"):
                continue

            rezka_year = extract_rezka_year(candidate_details)
            rezka_title = (candidate_details.get("title") or "").strip()

            # год: если оба известны и не совпадают — skip
            if (
                tmdb_year is not None
                and rezka_year is not None
                and tmdb_year != rezka_year
            ):
                continue

            sim = title_similarity(tmdb_title_ru, rezka_title)
            if sim < min_title_similarity:
                continue

            if sim > best_sim:
                best_sim = sim
                best_details = candidate_details

        if not best_details:
            print(f"⚠️ Не найден подходящий матч по году/title для: {tmdb_title_ru}")
            continue

        details = best_details

        # 4) TMDB enrich (imdb_id -> fallback tmdb_id)
        tmdb_pack = {}
        tmdb = {}
        try:
            imdb_id = details.get("imdb_id")
            if imdb_id:
                tmdb_pack = await tmdb_by_imdb(
                    imdb_id,
                    language="ru-RU",
                    include_image_language="ru,en,null",
                )
            elif tmdb_id:
                tmdb_pack = await tmdb_by_id(
                    int(tmdb_id),
                    tmdb_type="movie",
                    language="ru-RU",
                    include_image_language="ru,en,null",
                )
            tmdb = (tmdb_pack or {}).get("tmdb") or {}
        except Exception as e:
            print(f"⚠️ TMDB enrich error for '{details.get('title')}': {e}")

        backdrop_tmdb = (
            tmdb.get("backdrop_url_original") or tmdb.get("backdrop_url") or ""
        )
        logo_url = tmdb.get("logo_url") or tmdb.get("logo_url_original") or ""
        poster_tmdb = tmdb.get("poster_url") or ""
        trailer_tmdb = tmdb.get("trailer_youtube") or ""

        # 5) image для карточки — лучше backdrop TMDB, иначе rezka image
        image_for_card = backdrop_tmdb or (details.get("image") or "")

        # 6) сохраняем в БД
        try:
            async with async_session() as session:
                async with session.begin():
                    new_featured = Featured(
                        id=str(details.get("id") or ""),
                        title=details.get("title") or "",
                        origin_name=details.get("origin_name"),
                        image=image_for_card,
                        duration=details.get("duration"),
                        description=details.get("description"),
                        rate=details.get("rate"),
                        genre=details.get("genre"),
                        country=details.get("country"),
                        director=details.get("director"),
                        age=details.get("age"),
                        link=details.get("link") or "",
                        action=details.get("action"),
                        favs=details.get("favs"),
                        trailer=details.get("trailer"),
                        imdb_id=details.get("imdb_id"),
                        translator_ids=details.get("translator_ids"),
                        season_ids=details.get("season_ids"),
                        episodes_schedule=details.get("episodes_schedule"),
                        release_date=details.get("release_date"),
                        # ✅ NEW
                        actors=details.get("actors"),
                        backdrop=backdrop_tmdb,
                        logo_url=logo_url,
                        poster_tmdb=poster_tmdb,
                        trailer_tmdb=trailer_tmdb,
                    )
                    session.add(new_featured)

            print(
                f"✅ Сохранено: {details.get('title')} | sim={best_sim:.2f} | tmdb_year={tmdb_year}"
            )
        except Exception as e:
            print(f"❌ Ошибка при сохранении в БД: {e}")


async def get_all_featured():
    async with async_session() as session:
        result = await session.execute(select(Featured))
        return result.scalars().all()
