import asyncio
import xml.etree.ElementTree as ET
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────────────
JACKETT_URL = "http://188.137.181.63:9117"
JACKETT_KEY = "p6dcy57yah3cwddyh9lds0bodfiwx0az"
TORRSERVE_URL = "http://188.137.181.63:8090"

app = FastAPI(title="Stream API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Search ─────────────────────────────────────────────────────────────────────
@app.get("/search")
async def search(q: str = Query(...), cat: str = Query("2000")):
    params = {"apikey": JACKETT_KEY, "t": "search", "q": q}
    if cat:
        params["cat"] = cat

    url = f"{JACKETT_URL}/api/v2.0/indexers/all/results/torznab/api"

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(url, params=params)
        if res.status_code != 200:
            raise HTTPException(502, f"Jackett error: {res.status_code}")

    return {"results": parse_jackett_xml(res.text)}


def parse_jackett_xml(xml: str) -> list:
    NS = {"torznab": "http://torznab.com/schemas/2015/feed"}
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        raise HTTPException(500, f"XML parse error: {e}")

    items = []
    for item in root.findall(".//item"):
        title = item.findtext("title") or ""
        magnet = ""
        enc = item.find("enclosure")
        if enc is not None:
            magnet = enc.get("url", "")

        size = int(item.findtext("size") or 0)

        attrs = {}
        for attr in item.findall("torznab:attr", NS):
            attrs[attr.get("name")] = attr.get("value")

        if not magnet:
            continue

        items.append({
            "title": title,
            "magnet": magnet,
            "size": size,
            "seeders": int(attrs.get("seeders", 0)),
            "peers": int(attrs.get("peers", 0)),
        })

    items.sort(key=lambda x: x["seeders"], reverse=True)
    return items


# ── Add to TorrServe ──────────────────────────────────────────────────────────
class AddRequest(BaseModel):
    magnet: str
    title: str = ""


@app.post("/add")
async def add_torrent(body: AddRequest):
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{TORRSERVE_URL}/torrents",
            json={"action": "add", "link": body.magnet, "title": body.title,
                  "poster": "", "data": "", "save_to_db": False},
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
                f"{TORRSERVE_URL}/torrents",
                json={"action": "get", "hash": hash_},
            )
            info = r.json()
            files = info.get("file_stats") or info.get("files") or []
            if files:
                break
            await asyncio.sleep(2)

    if not files:
        raise HTTPException(504, "TorrServe: файлы не появились за 40 секунд")

    VIDEO_EXT = {".mkv", ".mp4", ".avi", ".mov", ".ts", ".m2ts", ".wmv", ".flv", ".webm"}
    stream_files = []

    for f in files:
        name = f.get("path") or f.get("name") or ""
        fname = name.replace("\\", "/").split("/")[-1]
        ext = "." + fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext not in VIDEO_EXT:
            continue

        file_id = f.get("id", files.index(f) + 1)
        stream_url = f"{TORRSERVE_URL}/stream/{fname}?link={hash_}&index={file_id}&play"

        stream_files.append({
            "name": fname,
            "size": f.get("length") or f.get("size") or 0,
            "stream_url": stream_url,
        })

    return {"hash": hash_, "files": stream_files}


# ── Frontend ───────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def index():
    with open("index.html", encoding="utf-8") as f:
        return f.read()
