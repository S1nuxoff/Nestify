import json
import logging
import re
import time
import uuid
import uvicorn
from fastapi import FastAPI
from fastapi import Request
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.api import api_router
from app.api.v2.api import api_router_v2
from app.api.v3.api import api_router_v3
from app.api.v4.api import api_router_v4
from fastapi.middleware.cors import CORSMiddleware
from app.db.base import create_all_tables
from app.websockets import live_session
from app.websockets import player_hub


logger = logging.getLogger("nestify.backend")
logging.basicConfig(level=logging.INFO, format="%(message)s")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router_v2, prefix="/api/v2")
app.include_router(api_router_v3, prefix="/api/v3")
app.include_router(api_router_v4, prefix="/api/v4")
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


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()
    response = None
    error = None

    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        error = exc
        raise
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")
        log_payload = {
            "service": "backend",
            "event": "http_request",
            "request_id": request_id,
            "method": request.method,
            "path": re.sub(r"(/api/v4/play/).+", r"\1***", request.url.path),
            "query": str(request.url.query or ""),
            "status_code": response.status_code if response is not None else 500,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
        }
        if error is not None:
            log_payload["error"] = repr(error)
        logger.info(json.dumps(log_payload, ensure_ascii=False))
        if response is not None:
            response.headers["x-request-id"] = request_id


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "backend",
        "version": settings.VERSION,
    }


@app.on_event("startup")
async def on_startup():
    await create_all_tables()
    print("Database initialized.")
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    from app.services.hls_manager import start_cleanup_task
    start_cleanup_task()
    print("HLS cleanup task started.")
    # Load DB settings overrides into memory
    try:
        from sqlalchemy import select as sa_select
        from app.db.session import async_session as _session
        from app.models.app_settings import AppSettings
        async with _session() as session:
            rows = (await session.execute(sa_select(AppSettings))).scalars().all()
        for row in rows:
            if not hasattr(settings, row.key):
                continue
            current = getattr(settings, row.key)
            if isinstance(current, bool):
                setattr(settings, row.key, row.value.lower() in ("true", "1", "yes"))
            elif isinstance(current, int):
                setattr(settings, row.key, int(row.value))
            else:
                setattr(settings, row.key, row.value)
        print(f"Loaded {len(rows)} setting override(s) from DB.")
    except Exception as e:
        print(f"Could not load settings from DB: {e}")


@app.get("/")
async def root():
    return {"message": "Welcome to the API"}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
