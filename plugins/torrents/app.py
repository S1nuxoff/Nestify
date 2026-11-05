"""Torrent search plugin for Nestify. The protocol is described in docs/plugins.md.

The plugin only finds torrents. Nestify plays what it finds through its own TorrServer and HLS engine.
"""

import asyncio
import hmac
import logging
import os
import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

import domem
from search import Config, Searcher

# httpx logs full URLs at INFO, and Jackett URLs contain its key.
logging.getLogger("httpx").setLevel(logging.WARNING)

PLUGIN_TOKEN = os.environ["PLUGIN_TOKEN"]
MAX_PER_LANGUAGE = 250
MAX_ID_LENGTH = 2000
EMBED_PREFIX = "embed:"

searcher = Searcher(Config())


def get_searcher() -> Searcher:
    return searcher


def get_embed_fetcher():
    return domem.fetch_embed


def require_token(authorization: str = Header(default="")) -> None:
    if not hmac.compare_digest(authorization.encode(), f"Bearer {PLUGIN_TOKEN}".encode()):
        raise HTTPException(401, "unauthorized")


class SourcesRequest(BaseModel):
    media_type: Literal["movie", "tv"]
    title: str = Field(min_length=1, max_length=500)
    original_title: Optional[str] = Field(default=None, max_length=500)
    year: Optional[int] = None
    imdb_id: Optional[str] = Field(default=None, max_length=32)
    titles: dict[str, str] = Field(default_factory=dict)


class ResolveRequest(BaseModel):
    source_id: str = Field(max_length=2048)


def source_id(magnet: str) -> str:
    """Magnets carry long tracker lists, and the id has a length limit. The hash is what matters."""
    if len(magnet) <= MAX_ID_LENGTH:
        return magnet
    return re.sub(r"&tr=[^&]*", "", magnet)[:MAX_ID_LENGTH]


def to_source(item: dict, language: str) -> dict:
    voices = item.get("voices") or []
    return {
        "id": source_id(item["magnet"]),
        "title": item.get("title") or "Без назви",
        "kind": "torrent",
        "language": language,
        "voice": voices[0][:255] if voices else None,
        "quality": item.get("quality"),
        "size_bytes": item.get("size") or 0,
        "seeders": item.get("seeders") or 0,
        "extra": {
            "magnet": item["magnet"],
            "voices": voices,
            "videotype": item.get("videotype") or "",
            "peers": item.get("peers") or 0,
            "pub_date": item.get("pub_date") or "",
            "tracker": item.get("tracker") or "",
        },
    }


app = FastAPI(title="Nestify torrents plugin", docs_url=None, redoc_url=None, openapi_url=None)
protected = APIRouter(dependencies=[Depends(require_token)])


@app.get("/health")
def health():
    return {"ok": True}


@protected.get("/manifest.json")
def manifest():
    return {
        "id": "torrents",
        "name": "Торренти",
        "version": "1.0.0",
        "api_version": 1,
        "description": "Пошук торрентів і вбудований плеєр domem.",
        "kinds": ["torrent", "embed"],
    }


@protected.post("/sources")
async def sources(body: SourcesRequest, search: Searcher = Depends(get_searcher), fetch_embed=Depends(get_embed_fetcher)):
    groups, embed = await asyncio.gather(
        search.search(
            title=body.title, original_title=body.original_title or body.title,
            title_en=body.titles.get("en"), title_pl=body.titles.get("pl"),
            year=body.year, media_type=body.media_type,
        ),
        fetch_embed(body.imdb_id),
    )
    found = [
        to_source(item, language)
        for language, items in groups.items()
        for item in items[:MAX_PER_LANGUAGE]
    ]
    if embed:
        found.append({
            "id": f"{EMBED_PREFIX}{embed['imdb_id']}",
            "title": embed.get("title") or body.title,
            "kind": "embed",
            "extra": {"embed": embed},
        })
    return {"sources": found}


@protected.post("/resolve")
async def resolve(body: ResolveRequest, fetch_embed=Depends(get_embed_fetcher)):
    if body.source_id.startswith("magnet:"):
        return {"kind": "torrent", "magnet": body.source_id}
    if body.source_id.startswith(EMBED_PREFIX):
        embed = await fetch_embed(body.source_id[len(EMBED_PREFIX):])
        if not embed:
            raise HTTPException(404, "embed not found")
        return {"kind": "embed", "embed_url": embed["embed_url"]}
    # Jackett can return a download link instead of a magnet. The client takes it from "extra".
    raise HTTPException(400, "this source has no magnet link")


app.include_router(protected)
