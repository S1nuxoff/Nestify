"""Wire format of the source plugin protocol (see docs/plugins.md)."""

from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, Field, field_validator, model_validator

API_VERSION = 1

Kind = Literal["direct", "hls", "torrent", "embed"]


def _require_http(url: str) -> str:
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError("url must be http or https")
    return url


HttpUrl = Annotated[str, Field(max_length=8192), AfterValidator(_require_http)]


class Manifest(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,63}$")
    name: str = Field(min_length=1, max_length=255)
    version: str = Field(min_length=1, max_length=64)
    api_version: int
    description: Optional[str] = Field(default=None, max_length=2000)
    kinds: list[Kind] = Field(min_length=1)

    @field_validator("api_version")
    @classmethod
    def _supported(cls, value: int) -> int:
        if value != API_VERSION:
            raise ValueError(f"unsupported api_version {value}, expected {API_VERSION}")
        return value


class SourcesRequest(BaseModel):
    media_type: Literal["movie", "tv"]
    title: str = Field(min_length=1, max_length=500)
    original_title: Optional[str] = Field(default=None, max_length=500)
    year: Optional[int] = None
    tmdb_id: Optional[str] = Field(default=None, max_length=32)
    imdb_id: Optional[str] = Field(default=None, max_length=32)
    season: Optional[int] = Field(default=None, ge=0)
    episode: Optional[int] = Field(default=None, ge=0)
    # Names in other languages, for example {"en": "...", "pl": "..."}.
    titles: Optional[dict[str, str]] = None
    # Only ask plugins that offer these kinds, so a fast start does not wait for a slow search.
    kinds: Optional[list[Kind]] = None


class Source(BaseModel):
    # Opaque to Nestify: the plugin gets it back in /resolve.
    id: str = Field(min_length=1, max_length=2048)
    title: str = Field(min_length=1, max_length=500)
    kind: Kind
    voice: Optional[str] = Field(default=None, max_length=255)
    quality: Optional[str] = Field(default=None, max_length=64)
    language: Optional[str] = Field(default=None, max_length=16)
    size_bytes: Optional[int] = Field(default=None, ge=0)
    seeders: Optional[int] = Field(default=None, ge=0)
    # Data for the client that depends on the kind, see docs/plugins.md.
    extra: dict = Field(default_factory=dict)


class SourcesResponse(BaseModel):
    sources: list[Source]


class Stream(BaseModel):
    quality: str = Field(min_length=1, max_length=64)
    url: HttpUrl
    headers: dict[str, str] = Field(default_factory=dict)


class Subtitle(BaseModel):
    lang: str = Field(min_length=1, max_length=64)
    url: HttpUrl
    label: Optional[str] = Field(default=None, max_length=255)
    headers: dict[str, str] = Field(default_factory=dict)


class Resolved(BaseModel):
    kind: Kind
    playback: Literal["direct", "proxy"] = "direct"
    streams: list[Stream] = Field(default_factory=list)
    subtitles: list[Subtitle] = Field(default_factory=list)
    magnet: Optional[str] = Field(default=None, max_length=8192)
    embed_url: Optional[HttpUrl] = None

    @model_validator(mode="after")
    def _consistent(self) -> "Resolved":
        if self.kind in ("direct", "hls") and not self.streams:
            raise ValueError(f"{self.kind} requires streams")
        if self.kind == "torrent" and not (self.magnet or "").startswith("magnet:"):
            raise ValueError("torrent requires a magnet link")
        if self.kind == "embed" and not self.embed_url:
            raise ValueError("embed requires embed_url")
        if self.playback == "proxy" and self.kind != "direct":
            # HLS playlists would need rewriting, or their segments would bypass the proxy.
            raise ValueError("playback=proxy is only supported for kind=direct")
        if self.playback == "direct" and (
            any(s.headers for s in self.streams) or any(s.headers for s in self.subtitles)
        ):
            raise ValueError("custom headers require playback=proxy")
        return self
