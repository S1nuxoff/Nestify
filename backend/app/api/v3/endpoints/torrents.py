from fastapi import APIRouter, Query

from app.schemas.torrent import (
    AddTorrentRequest,
    AddTorrentResponse,
    SearchResponse,
    TorrentStatus,
)
from app.services import jackett, torrserve

router = APIRouter()


@router.get("/search", response_model=SearchResponse, summary="Search torrents via Jackett")
async def search(
    q: str = Query(...),
    title: str | None = Query(None),
    title_original: str | None = Query(None),
    year: int | None = Query(None),
):
    results = await jackett.search_torrents(
        q=q,
        title=title,
        title_original=title_original,
        year=year,
    )
    return {"results": results}


@router.post("/add", response_model=AddTorrentResponse, summary="Add torrent to TorrServe")
async def add(body: AddTorrentRequest):
    return await torrserve.add_torrent(magnet=body.magnet, title=body.title)


@router.get("/status/{hash}", response_model=TorrentStatus, summary="Get torrent status")
async def status(hash: str):
    return await torrserve.get_torrent_status(hash_=hash)


@router.delete("/remove/{hash}", summary="Remove torrent from TorrServe")
async def remove(hash: str):
    await torrserve.remove_torrent(hash_=hash)
    return {"ok": True}
