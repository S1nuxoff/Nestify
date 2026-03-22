import asyncio
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from HdRezkaApi import HdRezkaSession
from app.services.rezka import COOKIES, HEADERS
from app.core.config import settings

router = APIRouter()

def _mirror() -> str:
    return f"https://{settings.REZKA_MIRROR}/"


def _get_stream_sync(url: str, translator_id: Optional[str], season: Optional[int], episode: Optional[int]) -> dict:
    with HdRezkaSession(_mirror(), cookies=COOKIES, headers=HEADERS) as session:
        rezka = session.get(url)
        if not rezka.ok:
            raise Exception(str(rezka.exception))

        translation = translator_id or None

        if season is not None and episode is not None:
            stream = rezka.getStream(str(season), str(episode), translation=translation)
        else:
            stream = rezka.getStream(translation=translation)

        if not stream:
            raise Exception("No stream found")

        source_links = [
            {"quality": q, "urls": urls}
            for q, urls in stream.videos.items()
        ]

        subtitles = {}
        if stream.subtitles and stream.subtitles.subtitles:
            subtitles = stream.subtitles.subtitles

        return {
            "translator_id": str(stream.translator_id),
            "season": stream.season,
            "episode": stream.episode,
            "source_links": source_links,
            "subtitles": subtitles,
        }


@router.get("/stream")
async def get_stream(
    url: str = Query(..., description="Rezka movie/series URL"),
    translator_id: Optional[str] = Query(None, description="Translator ID"),
    season: Optional[int] = Query(None),
    episode: Optional[int] = Query(None),
):
    """
    Get video stream URLs via HdRezkaApi.
    Returns source_links: [{quality, urls: [url1, url2]}]
    """
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            None, lambda: _get_stream_sync(url, translator_id, season, episode)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/translators")
async def get_translators(
    url: str = Query(..., description="Rezka movie/series URL"),
):
    """
    Get available translators for a movie/series.
    """
    loop = asyncio.get_running_loop()

    def _sync():
        with HdRezkaSession(_mirror(), cookies=COOKIES, headers=HEADERS) as session:
            rezka = session.get(url)
            if not rezka.ok:
                raise Exception(str(rezka.exception))
            return {
                "translators": rezka.translators,
            }

    try:
        result = await loop.run_in_executor(None, _sync)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
