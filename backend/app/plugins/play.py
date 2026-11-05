"""Short-lived playback links for media that must be fetched by this server.

The upstream URL and headers stay in memory, so neither reaches the client. <video> and
ExoPlayer cannot send a bearer token, so the random link itself grants access. Links are lost
on restart, in which case the client resolves the source again. This relies on the backend
running as a single process, which is what backend/Dockerfile does.
"""

import secrets
import time
from collections import OrderedDict
from dataclasses import dataclass, field

TTL_SECONDS = 6 * 60 * 60
MAX_SESSIONS = 5000


@dataclass
class PlayTarget:
    url: str
    headers: dict[str, str] = field(default_factory=dict)
    media_type: str | None = None
    expires_at: float = 0.0


class PlaySessions:
    def __init__(self, ttl: int = TTL_SECONDS, limit: int = MAX_SESSIONS):
        self._ttl = ttl
        self._limit = limit
        self._items: OrderedDict[str, PlayTarget] = OrderedDict()

    def create(self, url: str, headers: dict[str, str] | None = None, media_type: str | None = None) -> str:
        now = time.time()
        for key in [k for k, v in self._items.items() if v.expires_at <= now]:
            del self._items[key]
        while len(self._items) >= self._limit:
            self._items.popitem(last=False)
        token = secrets.token_urlsafe(32)
        self._items[token] = PlayTarget(url, dict(headers or {}), media_type, now + self._ttl)
        return token

    def get(self, token: str) -> PlayTarget | None:
        target = self._items.get(token)
        if target is None:
            return None
        if target.expires_at <= time.time():
            del self._items[token]
            return None
        return target
