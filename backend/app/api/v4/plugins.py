import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.v1.endpoints.admin import get_current_admin
from app.api.v1.endpoints.auth import get_current_account
from app.core.config import settings
from app.models.accounts import Account
from app.models.source_plugin import SourcePlugin
from app.plugins.client import PluginClient, PluginError, base_url_of
from app.plugins.play import PlaySessions
from app.plugins.schemas import Resolved, SourcesRequest
from app.plugins.store import PluginStore

logger = logging.getLogger("nestify.plugins")
router = APIRouter()

_store = PluginStore()
_plugin_http = httpx.AsyncClient(follow_redirects=False, timeout=httpx.Timeout(15, read=30))
_media_http = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(15, read=60))
_sessions = PlaySessions()


def get_store() -> PluginStore:
    return _store


def get_plugin_client() -> PluginClient:
    return PluginClient(_plugin_http)


def get_media_http() -> httpx.AsyncClient:
    return _media_http


def get_sessions() -> PlaySessions:
    return _sessions


def _public(plugin: SourcePlugin) -> dict:
    return {
        "id": plugin.id,
        "name": plugin.name,
        "version": plugin.version,
        "manifest_url": plugin.manifest_url,
        "enabled": plugin.enabled,
        "has_token": bool(plugin.token),
        "kinds": plugin.manifest.get("kinds", []),
        "description": plugin.manifest.get("description"),
    }


class InstallRequest(BaseModel):
    manifest_url: str = Field(min_length=1, max_length=2048)
    token: Optional[str] = Field(default=None, max_length=4096)


class PatchRequest(BaseModel):
    enabled: Optional[bool] = None
    # An empty string removes the token.
    token: Optional[str] = Field(default=None, max_length=4096)


class ResolveRequest(BaseModel):
    plugin_id: str = Field(max_length=64)
    source_id: str = Field(min_length=1, max_length=2048)


@router.get("/plugins")
async def list_plugins(
    _: Account = Depends(get_current_admin),
    store: PluginStore = Depends(get_store),
):
    return [_public(p) for p in await store.list()]


@router.post("/plugins", status_code=201)
async def install_plugin(
    body: InstallRequest,
    _: Account = Depends(get_current_admin),
    store: PluginStore = Depends(get_store),
    client: PluginClient = Depends(get_plugin_client),
):
    try:
        base_url = base_url_of(body.manifest_url)
        manifest = await client.manifest(body.manifest_url.strip(), body.token)
    except PluginError as exc:
        raise HTTPException(400, str(exc)) from exc
    if await store.get(manifest.id):
        raise HTTPException(409, f"plugin '{manifest.id}' is already installed")
    plugin = await store.add(SourcePlugin(
        id=manifest.id,
        name=manifest.name,
        version=manifest.version,
        manifest_url=body.manifest_url.strip(),
        base_url=base_url,
        token=body.token or None,
        enabled=True,
        manifest=manifest.model_dump(),
    ))
    return _public(plugin)


@router.patch("/plugins/{plugin_id}")
async def patch_plugin(
    plugin_id: str,
    body: PatchRequest,
    _: Account = Depends(get_current_admin),
    store: PluginStore = Depends(get_store),
):
    fields = {}
    if body.enabled is not None:
        fields["enabled"] = body.enabled
    if body.token is not None:
        fields["token"] = body.token or None
    plugin = await store.update(plugin_id, **fields)
    if plugin is None:
        raise HTTPException(404, "plugin not found")
    return _public(plugin)


@router.post("/plugins/{plugin_id}/refresh")
async def refresh_plugin(
    plugin_id: str,
    _: Account = Depends(get_current_admin),
    store: PluginStore = Depends(get_store),
    client: PluginClient = Depends(get_plugin_client),
):
    plugin = await store.get(plugin_id)
    if plugin is None:
        raise HTTPException(404, "plugin not found")
    try:
        manifest = await client.manifest(plugin.manifest_url, plugin.token)
    except PluginError as exc:
        raise HTTPException(502, str(exc)) from exc
    if manifest.id != plugin.id:
        raise HTTPException(409, f"manifest now belongs to plugin '{manifest.id}'")
    updated = await store.update(
        plugin_id, name=manifest.name, version=manifest.version, manifest=manifest.model_dump()
    )
    return _public(updated)


@router.delete("/plugins/{plugin_id}", status_code=204)
async def delete_plugin(
    plugin_id: str,
    _: Account = Depends(get_current_admin),
    store: PluginStore = Depends(get_store),
):
    if not await store.delete(plugin_id):
        raise HTTPException(404, "plugin not found")


@router.post("/sources")
async def find_sources(
    body: SourcesRequest,
    _: Account = Depends(get_current_account),
    store: PluginStore = Depends(get_store),
    client: PluginClient = Depends(get_plugin_client),
):
    """Ask every enabled plugin at once. A failing plugin never hides the others' results."""
    plugins = await store.list(enabled_only=True)
    results = await asyncio.gather(
        *(client.sources(p.base_url, p.token, body) for p in plugins),
        return_exceptions=True,
    )
    sources, errors = [], []
    for plugin, result in zip(plugins, results):
        if isinstance(result, PluginError):
            errors.append({"plugin_id": plugin.id, "plugin_name": plugin.name, "message": str(result)})
        elif isinstance(result, BaseException):
            logger.error("plugin %s failed", plugin.id, exc_info=result)
            errors.append({"plugin_id": plugin.id, "plugin_name": plugin.name, "message": "internal error"})
        else:
            sources += [
                {**s.model_dump(), "plugin_id": plugin.id, "plugin_name": plugin.name} for s in result
            ]
    return {"sources": sources, "errors": errors}


def _play_url(token: str) -> str:
    return f"{settings.API_BASE_URL.rstrip('/')}/api/v4/play/{token}"


def _for_client(resolved: Resolved, sessions: PlaySessions) -> dict:
    """Same stream/subtitle shape that PlayerPage already takes: {quality, url} and {lang, url}."""
    proxied = resolved.playback == "proxy"
    streams, subtitles = [], []
    for s in resolved.streams:
        url = _play_url(sessions.create(s.url, s.headers)) if proxied else s.url
        streams.append({"quality": s.quality, "url": url})
    for s in resolved.subtitles:
        url = _play_url(sessions.create(s.url, s.headers, "text/vtt; charset=utf-8")) if proxied else s.url
        subtitles.append({"lang": s.lang, "label": s.label, "url": url})
    return {
        "kind": resolved.kind,
        "streams": streams,
        "subtitles": subtitles,
        "magnet": resolved.magnet,
        "embed_url": resolved.embed_url,
    }


@router.post("/resolve")
async def resolve_source(
    body: ResolveRequest,
    _: Account = Depends(get_current_account),
    store: PluginStore = Depends(get_store),
    client: PluginClient = Depends(get_plugin_client),
    sessions: PlaySessions = Depends(get_sessions),
):
    plugin = await store.get(body.plugin_id)
    if plugin is None or not plugin.enabled:
        raise HTTPException(404, "plugin not found")
    try:
        resolved = await client.resolve(plugin.base_url, plugin.token, body.source_id)
    except PluginError as exc:
        raise HTTPException(502, str(exc)) from exc
    return _for_client(resolved, sessions)


@router.get("/play/{token}")
async def play(
    token: str,
    request: Request,
    sessions: PlaySessions = Depends(get_sessions),
    http: httpx.AsyncClient = Depends(get_media_http),
):
    target = sessions.get(token)
    if target is None:
        raise HTTPException(404, "playback link expired")
    headers = {**target.headers, "Accept-Encoding": "identity"}
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]
    upstream = None
    if target.final_url:
        try:
            upstream = await http.send(http.build_request("GET", target.final_url, headers=headers), stream=True)
        except httpx.HTTPError:
            upstream = None
        if upstream is not None and upstream.status_code >= 400 and upstream.status_code != 416:
            await upstream.aclose()
            upstream = None
        if upstream is None:
            target.final_url = None  # it has expired, so go through the original link again
    if upstream is None:
        try:
            upstream = await http.send(http.build_request("GET", target.url, headers=headers), stream=True)
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"media source is unreachable: {type(exc).__name__}") from exc
        if upstream.status_code < 400 and str(upstream.url) != target.url:
            target.final_url = str(upstream.url)
    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose()
        if status == 416:
            raise HTTPException(416, "range not satisfiable")
        raise HTTPException(502, f"media source returned {status}")

    async def body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    passthrough = ("content-type", "content-length", "content-range", "accept-ranges")
    out = {k: upstream.headers[k] for k in passthrough if k in upstream.headers}
    if target.media_type:
        out["content-type"] = target.media_type
    return StreamingResponse(body(), status_code=upstream.status_code, headers=out)
