import uvicorn
from fastapi import FastAPI
from fastapi import Request
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.api import api_router
from fastapi.middleware.cors import CORSMiddleware
from app.db.base import create_all_tables
from app.websockets import live_session
from app.websockets import player_hub

from fastapi.responses import StreamingResponse
import httpx


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(live_session.router)
app.include_router(player_hub.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # или конкретный список доменов
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/proxy")
async def proxy_video(request: Request, url: str):
    """
    Проксируем MP4/HLS-поток, пробрасывая Range-заголовок и Referer.
    Работает с ReactPlayer / <video>, поддерживает перемотку.
    """
    # какие-то ссылки с voidboost не отдают видео без правильного Referer + UA
    base_headers = {
        "Referer": "https://voidboost.net",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
    }
    # если браузер прислал Range — пробрасываем
    if rng := request.headers.get("range"):
        base_headers["Range"] = rng

    async def stream_generator():
        # держим клиент и соединение открытыми, пока генерируем чанки
        async with httpx.AsyncClient(follow_redirects=True) as client:
            async with client.stream("GET", url, headers=base_headers) as resp:
                if resp.status_code >= 400:
                    # voidboost может вернуть 403/404
                    raise HTTPException(resp.status_code, "upstream error")

                # копируем важные заголовки для кеша/перемотки
                response_headers = {
                    k: v
                    for k, v in resp.headers.items()
                    if k.lower()
                    in {
                        "content-length",
                        "content-range",
                        "accept-ranges",
                        "content-type",
                    }
                }
                # отправляем их единственный раз – через yield None
                yield response_headers

                async for chunk in resp.aiter_bytes():
                    yield chunk

    gen = stream_generator()

    # «слово-хак»: берём первые yield-данные (заголовки) перед тем,
    # как StreamingResponse начнёт итерацию
    first = await gen.__anext__()  # dict c заголовками
    status = 206 if "Range" in base_headers else 200
    return StreamingResponse(
        gen,  # дальше пойдут сами чанки
        status_code=status,
        headers=first,
        media_type=first.get("Content-Type", "video/mp4"),
    )


@app.on_event("startup")
async def on_startup():
    await create_all_tables()
    print("Database initialized.")
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")


@app.get("/")
async def root():
    return {"message": "Welcome to the API"}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
