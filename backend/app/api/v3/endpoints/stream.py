import asyncio

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.schemas.torrent import (
    AddTorrentRequest,
    AddTorrentResponse,
    SearchResponse,
    TorrentStatus,
)
from app.services import domem, jackett, torrserve

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(...),
    title: str | None = Query(None),
    title_original: str | None = Query(None),
    title_en: str | None = Query(None),
    title_pl: str | None = Query(None),
    year: int | None = Query(None),
    imdb_id: str | None = Query(None),
    tmdb_id: str | None = Query(None),
    media_type: str = Query("movie"),
):
    print(f"[SEARCH] q={q!r} title={title!r} title_en={title_en!r} title_pl={title_pl!r} year={year}", flush=True)
    result, embed = await asyncio.gather(
        jackett.search_multilang(
            title=title,
            title_original=title_original,
            title_en=title_en,
            title_pl=title_pl,
            year=year,
            media_type=media_type,
        ),
        domem.fetch_embed_by_imdb(imdb_id),
    )
    print(f"[SEARCH] done uk={len(result['uk'])} ru={len(result['ru'])} en={len(result['en'])}", flush=True)
    result["embed"] = embed
    return result


@router.post("/add", response_model=AddTorrentResponse)
async def add(body: AddTorrentRequest):
    return await torrserve.add_torrent(magnet=body.magnet, title=body.title, poster=body.poster)


@router.get("/status/{hash}", response_model=TorrentStatus)
async def status(hash: str):
    return await torrserve.get_torrent_status(hash_=hash)


@router.delete("/remove/{hash}")
async def remove(hash: str):
    await torrserve.remove_torrent(hash_=hash)
    return {"ok": True}


@router.delete("/remove-all")
async def remove_all():
    """Видалити всі торренти з TorrServe (очистка накопиченого)."""
    import httpx
    from app.core.config import settings
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{settings.TORRSERVE_URL}/torrents",
            json={"action": "list"},
        )
        torrents = res.json() if res.status_code == 200 else []
        if not isinstance(torrents, list):
            torrents = []
        removed = 0
        for t in torrents:
            h = t.get("hash")
            if h:
                await client.post(
                    f"{settings.TORRSERVE_URL}/torrents",
                    json={"action": "rem", "hash": h},
                )
                removed += 1
    return {"removed": removed}


@router.get("/info/{hash}/{file_index}")
async def file_info(hash: str, file_index: int):
    """Проксі до TorrServe /ffp — повертає тривалість, кодеки тощо."""
    import httpx
    from app.core.config import settings
    url = f"{settings.TORRSERVE_URL}/ffp/{hash}/{file_index}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(url)
            if res.status_code == 200:
                return res.json()
    except Exception:
        pass
    return {}


@router.get("/preload/{hash}/{file_index}")
async def preload(hash: str, file_index: int):
    import httpx
    from app.core.config import settings
    url = f"{settings.TORRSERVE_URL}/stream/preload?link={hash}&index={file_index}"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.get(url)
    except Exception:
        pass
    return {"ok": True}


@router.get("/play/{fname}")
async def play(
    fname: str,
    link: str = Query(...),
    index: int = Query(...),
    transcode: bool = Query(False),
    t: float = Query(0),
    request: Request = None,
):
    import asyncio
    import httpx
    from app.core.config import settings

    source_url = f"{settings.TORRSERVE_URL}/stream/{fname}?link={link}&index={index}&play"

    # ── Пряма проксі (без транскодування) ───────────────────────────────
    if not transcode:
        headers = {}
        if request and "range" in request.headers:
            headers["Range"] = request.headers["range"]

        async def stream_direct(client, response):
            try:
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()

        client = httpx.AsyncClient(timeout=None)
        req = client.build_request("GET", source_url, headers=headers)
        response = await client.send(req, stream=True)

        resp_headers = {
            "Content-Type": response.headers.get("Content-Type", "video/mp4"),
            "Accept-Ranges": "bytes",
        }
        if "Content-Length" in response.headers:
            resp_headers["Content-Length"] = response.headers["Content-Length"]
        if "Content-Range" in response.headers:
            resp_headers["Content-Range"] = response.headers["Content-Range"]

        return StreamingResponse(
            stream_direct(client, response),
            status_code=response.status_code,
            headers=resp_headers,
            media_type=response.headers.get("Content-Type", "video/mp4"),
        )

    # ── FFmpeg транскодування аудіо → AAC, відео копія ──────────────────
    # Відео не перекодовується (-c:v copy) — тільки аудіо у AAC 192k.
    # Контейнер MKV, бо підтримує будь-який відео-кодек (h264, hevc, av1).
    ffmpeg_cmd = [
        "ffmpeg",
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        *(["-ss", str(t)] if t > 0 else []),  # seek до потрібної позиції
        "-i", source_url,
        "-map", "0:v?",
        "-map", "0:a?",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        "-f", "matroska",
        "pipe:1",
    ]

    async def stream_ffmpeg():
        proc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            while True:
                chunk = await proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                proc.kill()
            except Exception:
                pass

    return StreamingResponse(
        stream_ffmpeg(),
        status_code=200,
        headers={"Content-Type": "video/x-matroska"},
        media_type="video/x-matroska",
    )
