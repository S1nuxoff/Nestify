"""HTTP client for remote source plugins. Everything a plugin returns is validated."""

import json

import httpx
from pydantic import BaseModel, ValidationError

from app.plugins.schemas import Manifest, Resolved, Source, SourcesRequest, SourcesResponse

MAX_RESPONSE_BYTES = 4 * 1024 * 1024
MAX_SOURCES = 1000
MANIFEST_NAME = "manifest.json"


class PluginError(Exception):
    """The plugin is unreachable or broke the protocol. The message is safe to show to users."""


def base_url_of(manifest_url: str) -> str:
    url = manifest_url.strip().rstrip("/")
    if not url.lower().startswith(("http://", "https://")):
        raise PluginError("manifest URL must be http or https")
    base, _, name = url.rpartition("/")
    if name != MANIFEST_NAME:
        raise PluginError(f"manifest URL must end with /{MANIFEST_NAME}")
    return base


class PluginClient:
    def __init__(self, http: httpx.AsyncClient):
        # Created without redirects, so a plugin cannot forward its token to another host.
        self._http = http

    async def _call(self, method: str, url: str, token: str | None, body: dict | None = None) -> dict:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            async with self._http.stream(method, url, headers=headers, json=body) as response:
                if response.status_code != 200:
                    raise PluginError(f"plugin returned HTTP {response.status_code}")
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw += chunk
                    if len(raw) > MAX_RESPONSE_BYTES:
                        raise PluginError("plugin response is too large")
        except httpx.HTTPError as exc:
            raise PluginError(f"plugin is unreachable: {type(exc).__name__}") from exc
        try:
            return json.loads(bytes(raw))
        except ValueError as exc:
            raise PluginError("plugin returned invalid JSON") from exc

    @staticmethod
    def _parse(model: type[BaseModel], data: dict):
        try:
            return model.model_validate(data)
        except ValidationError as exc:
            where = ".".join(str(p) for p in exc.errors()[0]["loc"]) or "response"
            raise PluginError(f"plugin broke the protocol at '{where}'") from exc

    async def manifest(self, manifest_url: str, token: str | None) -> Manifest:
        base_url_of(manifest_url)
        return self._parse(Manifest, await self._call("GET", manifest_url, token))

    async def sources(self, base_url: str, token: str | None, request: SourcesRequest) -> list[Source]:
        data = await self._call("POST", f"{base_url}/sources", token, request.model_dump(exclude_none=True, exclude={"kinds"}))
        return self._parse(SourcesResponse, data).sources[:MAX_SOURCES]

    async def resolve(self, base_url: str, token: str | None, source_id: str) -> Resolved:
        data = await self._call("POST", f"{base_url}/resolve", token, {"source_id": source_id})
        return self._parse(Resolved, data)
