import asyncio

import httpx
from fastapi import HTTPException

from app.core.config import settings

# Stream URLs go through the backend proxy so the browser avoids
# mixed-content (HTTP from HTTPS page) and cross-origin CORS issues.
def _proxy_stream_url(fname: str, hash_: str, file_id: int, transcode: bool = True) -> str:
    base = f"{settings.API_BASE_URL}/api/v3/stream/play/{fname}?link={hash_}&index={file_id}"
    return base + ("&transcode=true" if transcode else "")

VIDEO_EXT = {".mkv", ".mp4", ".avi", ".mov", ".ts", ".m2ts", ".wmv", ".flv", ".webm"}


async def add_torrent(magnet: str, title: str = "", poster: str = "") -> dict:
    """Add magnet to TorrServe, wait for files, return hash + stream urls."""
    async with httpx.AsyncClient(timeout=90) as client:
        res = await client.post(
            f"{settings.TORRSERVE_URL}/torrents",
            json={
                "action":      "add",
                "link":        magnet,
                "title":       title,
                "poster":      poster,
                "data":        "",
                "save_to_db":  False,  # не зберігати в БД — автоматично прибирається
            },
        )
        if res.status_code != 200:
            raise HTTPException(502, f"TorrServe add error: {res.status_code} {res.text}")

        data = res.json()
        hash_ = data.get("hash")
        if not hash_:
            raise HTTPException(502, "TorrServe didn't return hash")

        files = []
        for _ in range(20):
            r = await client.post(
                f"{settings.TORRSERVE_URL}/torrents",
                json={"action": "get", "hash": hash_},
            )
            info = r.json()
            files = info.get("file_stats") or info.get("files") or []
            if files:
                break
            await asyncio.sleep(2)

    if not files:
        raise HTTPException(504, "TorrServe: files not ready in 40 seconds")

    return {"hash": hash_, "files": _build_stream_files(hash_, files)}


async def get_torrent_status(hash_: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{settings.TORRSERVE_URL}/torrents",
            json={"action": "get", "hash": hash_},
        )
        if res.status_code != 200:
            raise HTTPException(502, f"TorrServe error: {res.status_code}")

        info = res.json()
        files = info.get("file_stats") or info.get("files") or []

        return {
            "hash": hash_,
            "title": info.get("title", ""),
            "stat": info.get("stat", 0),
            "stat_string": info.get("stat_string", ""),
            "torrent_size": info.get("torrent_size", 0),
            "download_speed": info.get("download_speed", 0),
            "upload_speed": info.get("upload_speed", 0),
            "peers_total": info.get("peers_total", 0),
            "peers_connected": info.get("peers_connected", 0),
            "files": _build_stream_files(hash_, files),
        }


async def remove_torrent(hash_: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{settings.TORRSERVE_URL}/torrents",
            json={"action": "rem", "hash": hash_},
        )
        if res.status_code != 200:
            raise HTTPException(502, f"TorrServe remove error: {res.status_code}")


def _build_stream_files(hash_: str, files: list) -> list[dict]:
    result = []
    for f in files:
        name = f.get("path") or f.get("name") or ""
        fname = name.replace("\\", "/").split("/")[-1]
        ext = "." + fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext not in VIDEO_EXT:
            continue

        file_id = f.get("id", files.index(f) + 1)
        stream_url = _proxy_stream_url(fname, hash_, file_id)

        result.append(
            {
                "name":         fname,
                "size":         f.get("length") or f.get("size") or 0,
                "file_id":      file_id,
                "stream_url":   _proxy_stream_url(fname, hash_, file_id, transcode=True),
                "stream_url_direct": _proxy_stream_url(fname, hash_, file_id, transcode=False),
            }
        )
    return result
