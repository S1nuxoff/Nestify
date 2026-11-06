"""HDRezka source plugin for Nestify. The protocol is described in docs/plugins.md."""

import hmac
import logging
import os
import re
import time
import urllib.request
from typing import Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from rezka import Blocked, MapStore, Matcher, Site, TtlCache, parse_cookies, token_expiry

log = logging.getLogger("rezka-plugin")

PLUGIN_TOKEN = os.environ["PLUGIN_TOKEN"]
ORIGIN = os.environ.get("REZKA_ORIGIN", "https://rezka.ag")
MAP_DATABASE_URL = os.environ.get("REZKA_MAP_DATABASE_URL", "")
USER_AGENT = os.environ.get(
    "REZKA_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
)
# Without a premium account the site serves a one-minute stub for these. Clear the setting if
# the cookies belong to a premium account.
HIDDEN_QUALITIES = {
    q.strip() for q in os.environ.get("REZKA_HIDDEN_QUALITIES", "1080p Ultra,2K,4K").split(",") if q.strip()
}
SOURCE_ID = re.compile(r"^(/[A-Za-z0-9/_.-]+\.html)\|(\d+)\|(\d*)\|(\d*)$")


matcher = Matcher(Site(
    ORIGIN,
    headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru,uk;q=0.9,en;q=0.8",
        "Referer": f"{ORIGIN.rstrip('/')}/",
    },
    cookies=parse_cookies(os.environ.get("REZKA_COOKIES", "")),
), mapping=MapStore(MAP_DATABASE_URL) if MAP_DATABASE_URL else None)


def get_matcher() -> Matcher:
    return matcher


def load_saved_cookies() -> None:
    """Cookies saved on the extensions page win over the ones set when the service was deployed."""
    if not matcher.mapping:
        return
    try:
        saved = matcher.mapping.load_cookies()
    except Exception:
        log.exception("could not read saved cookies, using REZKA_COOKIES")
        return
    if saved:
        matcher.site.cookies = saved


load_saved_cookies()


def require_token(authorization: str = Header(default="")) -> None:
    if not hmac.compare_digest(authorization.encode(), f"Bearer {PLUGIN_TOKEN}".encode()):
        raise HTTPException(401, "unauthorized")


class SourcesRequest(BaseModel):
    media_type: Literal["movie", "tv"]
    title: str = Field(min_length=1, max_length=500)
    original_title: Optional[str] = Field(default=None, max_length=500)
    year: Optional[int] = None
    tmdb_id: Optional[str] = Field(default=None, max_length=32)
    imdb_id: Optional[str] = Field(default=None, max_length=32)
    season: Optional[int] = Field(default=None, ge=0)
    episode: Optional[int] = Field(default=None, ge=0)


class ResolveRequest(BaseModel):
    source_id: str = Field(max_length=2048)


app = FastAPI(title="Nestify HDRezka plugin", docs_url=None, redoc_url=None, openapi_url=None)
protected = APIRouter(dependencies=[Depends(require_token)])


@app.exception_handler(Blocked)
async def on_blocked(_: Request, __: Blocked):
    return JSONResponse({"detail": "site bot check: renew REZKA_COOKIES from this server's IP"}, status_code=503)


@app.exception_handler(Exception)
async def on_error(_: Request, exc: Exception):
    # Library errors may quote request details, so only the type goes out.
    log.exception("request failed")
    return JSONResponse({"detail": f"site error: {type(exc).__name__}"}, status_code=502)


@app.get("/health")
def health():
    """Liveness only, so container health checks never hit the site."""
    return {"ok": True}


@protected.get("/status")
def status(m: Matcher = Depends(get_matcher)):
    """Whether the site accepts the cookies right now."""
    m.site.check_access()
    return {"ok": True}


STATUS_TTL = 5 * 60
SSH_KEY_NAME = os.environ.get("REZKA_SSH_KEY_NAME", "dota_server_ed25519")
_status = {"at": 0.0, "ok": None, "ip": None}


def server_ip() -> str:
    if not _status["ip"]:
        try:
            with urllib.request.urlopen("https://api.ipify.org", timeout=5) as response:
                _status["ip"] = response.read().decode().strip()
        except Exception:
            return "IP_СЕРВЕРА"
    return _status["ip"]


def settings_view(m: Matcher, message: str | None = None) -> dict:
    now = time.time()
    if now - _status["at"] > STATUS_TTL:
        try:
            m.site.check_access()
            _status["ok"] = True
        except Exception:
            _status["ok"] = False
        _status["at"] = now
    return {
        "status": {
            "ok": _status["ok"],
            "message": message or ("Сайт приймає куки" if _status["ok"] else "Сайт не приймає куки, потрібні нові"),
            "expires_at": token_expiry(m.site.cookies),
        },
        "fields": [{"key": "cookies", "label": "Куки", "placeholder": "Вставте значення cookie"}],
        "help": [
            {"text": "Відкрийте тунель через сервер у PowerShell і не закривайте вікно:",
             "command": f'ssh -i "$env:USERPROFILE\\.ssh\\{SSH_KEY_NAME}" -D 1080 -N root@{server_ip()}'},
            {"text": "У другому вікні запустіть окремий Chrome:",
             "command": f'& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --proxy-server="socks5://127.0.0.1:1080" --user-data-dir="$env:TEMP\\rezka-vps" {ORIGIN}/'},
            {"text": "Дочекайтесь кінця перевірки сайту. Натисніть F12, відкрийте Network і F5."},
            {"text": "Оберіть верхній запит, у Request Headers скопіюйте значення cookie і вставте його нижче."},
        ],
    }


class SettingsRequest(BaseModel):
    values: dict[str, str]


@protected.get("/settings")
def get_settings(m: Matcher = Depends(get_matcher)):
    return settings_view(m)


@protected.put("/settings")
def put_settings(body: SettingsRequest, m: Matcher = Depends(get_matcher)):
    cookies = parse_cookies(body.values.get("cookies", ""))
    if not cookies:
        raise HTTPException(400, "Вставте значення cookie: рядок виду назва=значення; назва=значення")
    if not m.mapping:
        raise HTTPException(400, "Плагін без бази даних, тому куки ніде зберегти. Задайте REZKA_MAP_DATABASE_URL")
    try:
        m.site.check_access(cookies)
    except Blocked:
        raise HTTPException(400, "Сайт не прийняв ці куки. Скопіюйте їх із браузера, запущеного через тунель")
    except Exception:
        raise HTTPException(400, "Не вдалося перевірити куки: сайт не відповідає. Спробуйте ще раз")
    m.mapping.save_cookies(cookies)
    m.site.cookies = cookies
    # Loaded pages hold the old cookies, and searches may have failed because of them.
    m.pages = TtlCache()
    m.matches = TtlCache()
    _status.update(at=time.time(), ok=True)
    return settings_view(m, "Куки збережено, сайт їх приймає")


@protected.get("/manifest.json")
def manifest():
    return {
        "id": "rezka",
        "name": "HDRezka",
        "version": "1.0.0",
        "api_version": 1,
        "description": "Films and series from HDRezka with voice-overs and subtitles.",
        "kinds": ["direct"],
    }


@protected.post("/sources")
def sources(body: SourcesRequest, m: Matcher = Depends(get_matcher)):
    is_tv = body.media_type == "tv"
    if is_tv and (body.season is None or body.episode is None):
        return {"sources": []}
    page = m.find(body.media_type, body.title, body.original_title, body.year, body.tmdb_id, body.imdb_id)
    if page is None:
        return {"sources": []}

    if is_tv:
        voices = [
            (voice_id, info["translator_name"])
            for voice_id, info in page.seriesInfo.items()
            if body.episode in info["episodes"].get(body.season, {})
        ]
        season, episode = body.season, body.episode
    else:
        voices = [(voice_id, info["name"]) for voice_id, info in page.translators.items()]
        season, episode = "", ""

    return {"sources": [
        {"id": f"{page._path}|{voice_id}|{season}|{episode}", "title": name, "voice": name, "kind": "direct"}
        for voice_id, name in voices
    ]}


@protected.post("/resolve")
def resolve(body: ResolveRequest, m: Matcher = Depends(get_matcher)):
    match = SOURCE_ID.match(body.source_id)
    if not match or ".." in match.group(1):
        raise HTTPException(400, "invalid source_id")
    path, voice_id, season, episode = match.groups()
    page = m.page(path)
    if season and episode:
        stream = page.getStream(season, episode, translation=voice_id)
    else:
        stream = page.getStream(translation=voice_id)
    subtitles = getattr(getattr(stream, "subtitles", None), "subtitles", None) or {}
    # Links only work from this server's IP, so playback always goes through the server.
    return {
        "kind": "direct",
        "playback": "proxy",
        "streams": [
            {"quality": quality, "url": str(urls[0])}
            for quality, urls in stream.videos.items() if urls and quality not in HIDDEN_QUALITIES
        ],
        "subtitles": [
            {"lang": lang, "label": item.get("title"), "url": item["link"]}
            for lang, item in subtitles.items()
        ],
    }


app.include_router(protected)
