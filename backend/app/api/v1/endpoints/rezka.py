from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from fastapi_cache.decorator import cache
import datetime
from urllib.parse import quote_plus

from app.services.media.add_movie import add_movie
from app.services.rezka import extract_id_from_url, get_search
from app.services.media.get_movie import get_movie_db

from app.services.media.get_watch_history import get_watch_history

from app.schemas.progress import ProgressIn, ProgressOut
from app.services.media.watch_history import (
    update_watch_position,
    get_watch_position,
    get_last_watch_for_movie,
    get_all_watches_for_movie,
)
from app.services.media.updateTrailers import updateTrailers
from app.schemas.rezka import (
    Rezka,
    FilmCard,
    GetSourceResponse,
    PageResponse,
    TopNavCategoriesResponse,
    WatchHistoryItem,
    MovieHistoryCreate,
    LastWatch,  # 👈 это есть, оставляем
)
from app.services.rezka import (
    get_movie,
    search,
    get_page,
    get_movie_ifo,
    get_main_page,
    get_categories,
    get_url_by_id,
    get_collections,
)
from app.core.config import settings
from app.services.rezka import get_source

router = APIRouter()


@router.get("/get_movie", response_model=Rezka, summary="Get rezka movie by link")
async def fetch_movie(
    link: str,
    user_id: Optional[int] = Query(None, description="ID користувача (необов'язково)"),
):
    movie_id = extract_id_from_url(link)

    movie = await get_movie_db(movie_id)

    # helper: собираем history-пейлоад из ORM-строк
    async def build_history_payload() -> tuple[list[dict], Optional[dict]]:
        if user_id is None:
            return [], None

        rows = await get_all_watches_for_movie(user_id=user_id, movie_id=movie_id)
        if not rows:
            return [], None

        history = []
        for r in rows:
            history.append(
                {
                    "translator_id": r.translator_id,
                    "season": r.season,
                    "episode": r.episode,
                    "duration": r.duration,
                    "position_seconds": r.position_seconds,
                    "watched_at": r.watched_at,
                    "updated_at": r.updated_at,
                }
            )

        last_row = rows[0]  # мы уже отсортировали desc по updated_at/watched_at
        last = {
            "translator_id": last_row.translator_id,
            "season": last_row.season,
            "episode": last_row.episode,
            "duration": last_row.duration,
            "position_seconds": last_row.position_seconds,
            "watched_at": last_row.watched_at,
            "updated_at": last_row.updated_at,
        }

        return history, last

    # если в БД ещё нет — тянем с зеркала и сохраняем
    if not movie:
        movie_data = await get_movie(link)
        if not movie_data:
            raise HTTPException(status_code=404, detail="movie not found")

        await add_movie(movie_data)

        history, last = await build_history_payload()
        movie_data["watch_history"] = history
        movie_data["last_watch"] = last

        return movie_data

    # movie найден в БД — это ORM-объект
    rezka_base = Rezka.model_validate(movie)  # thanks from_attributes=True
    data = rezka_base.model_dump()

    history, last = await build_history_payload()
    data["watch_history"] = history
    data["last_watch"] = last

    return data


@router.get("/get_watch_history")
async def fetch_watch_history(user_id: int = Query(..., description="ID користувача")):

    try:
        result = await get_watch_history(user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=List[FilmCard])
async def search_movie(title: str):
    q = title.strip()
    if not q:
        raise HTTPException(status_code=400, detail="empty title")

    # БЕЗПЕЧНО кодуємо запит
    url = f"{settings.SEARCH_URL_BASE}{quote_plus(q)}"
    print("SEARCH URL:", url)

    search_result = await search(url)

    # тимчасово НЕ кидати 404, щоб бачити, що реально приходить
    if search_result is None:
        raise HTTPException(status_code=500, detail="parser returned None")

    if not search_result:
        # Поки що просто повертаємо пустий масив, щоб фронт не падав
        # raise HTTPException(status_code=404, detail="movie not found")
        return []

    return search_result


@router.get("/get_search")
async def get_searh_suggestions(title: str):
    search_result = await get_search(title)
    if not search_result:
        raise HTTPException(status_code=404, detail="movie not found")
    return search_result


@router.get("/get_page", response_model=PageResponse)
async def fetch_page(link: str):
    page = await get_page(link)
    if not page or not page["items"]:
        raise HTTPException(status_code=404, detail="movie not found")
    return page


# @router.get("/get_main_page", response_model=List[FilmCard])
# @cache(expire=60 * 60 * 24)
# async def fetch_page():
#     page = await get_page("https://hdrezka.ag/new/")
#     if not page:
#         raise HTTPException(status_code=404, detail="movie not found")
#     return page


@router.get("/get_collections")
@cache(expire=60 * 60 * 24)
async def get_collections_route():
    """
    Просто віддає список колекцій.
    Frontend отримає чистий масив, без обгортки { "collections": ... }.
    """
    return await get_collections()


@router.get("/get_main_page")
@cache(expire=60 * 60 * 24)
async def get_main_page_route():

    return await get_main_page(
        newest_url="https://hdrezka.ag/new/",
        popular_url="https://hdrezka.ag/?filter=popular",
        watching_url="https://hdrezka.ag/?filter=watching",
    )


@router.get(
    "/get_source",
    response_model=GetSourceResponse,
    summary="Get direct video links (minimal)",
)
def fetch_source_api(
    film_id: str,
    translator_id: str,
    season_id: int = 0,
    episode_id: int = 0,
    action: str = "get_stream",
):
    """
    Возвращает список source_links по указанному фильму/сериалу, переводчику, сезону и эпизоду.
    """

    params = {"t": datetime.datetime.now()}
    favs_value = "1"

    translators = [{"id": translator_id, "name": ""}]
    episodes = []

    source_result = get_source(
        film_id=film_id,
        translators=translators,
        season_from_url=season_id,
        episode_from_url=episode_id,
        episodes=episodes,
        ctrl_favs_value=favs_value,
        action=action,
        params=params,
    )

    if not source_result:
        raise HTTPException(status_code=404, detail="No source links found")

    # Возвращаем в виде { "sources": [...] }
    return GetSourceResponse(sources=source_result)


@router.get(
    "/get_categories",
)
@cache(expire=60 * 60 * 24)  # ← кеш на сутки
async def fetch_categories(url):
    response = get_categories(url)
    if not response:
        raise HTTPException(status_code=404, detail="movie not found")
    return response


@router.get(
    "/get_url_by_id",
)
async def fetch_url_by_id(mirror, id):
    response = await get_url_by_id(mirror, id)
    if not response:
        raise HTTPException(status_code=404, detail="movie not found")
    return response


@router.put(
    "/progress",
    status_code=204,
    summary="Зберегти поточну позицію відтворення",
)
async def save_progress(payload: ProgressIn):

    await update_watch_position(
        user_id=payload.user_id,
        movie_id=payload.movie_id,
        position_seconds=payload.position_seconds,
        season=payload.season,
        episode=payload.episode,
        duration=payload.duration,
        create_if_absent=True,
    )
    return  # 204


@router.get(
    "/progress",
    response_model=ProgressOut,
    summary="Отримати збережену позицію для фільму/серії",
)
async def fetch_progress(
    user_id: int = Query(...),
    movie_id: str = Query(...),
    season: int | None = Query(None),
    episode: int | None = Query(None),
):
    pos = await get_watch_position(
        user_id=user_id,
        movie_id=movie_id,
        season=season,
        episode=episode,
    )
    return ProgressOut(position_seconds=pos)
