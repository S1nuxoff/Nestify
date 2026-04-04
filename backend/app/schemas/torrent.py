from pydantic import BaseModel


class TorrentResult(BaseModel):
    title: str
    magnet: str
    size: int
    seeders: int
    peers: int


class SearchResponse(BaseModel):
    results: list[TorrentResult]


class AddTorrentRequest(BaseModel):
    magnet: str
    title: str = ""


class StreamFile(BaseModel):
    name: str
    size: int
    stream_url: str


class AddTorrentResponse(BaseModel):
    hash: str
    files: list[StreamFile]


class TorrentStatus(BaseModel):
    hash: str
    title: str
    stat: int
    stat_string: str
    torrent_size: int
    download_speed: int
    upload_speed: int
    peers_total: int
    peers_connected: int
    files: list[StreamFile]


class ProgressSaveRequest(BaseModel):
    user_id: int
    movie_id: str
    position_seconds: int
    duration: int | None = None
    season: int | None = None
    episode: int | None = None


class ProgressResponse(BaseModel):
    position_seconds: int


class WatchHistoryItem(BaseModel):
    movie_id: str
    season: int | None
    episode: int | None
    position_seconds: int
    duration: int | None
    watched_at: str
    updated_at: str
