from pydantic import BaseModel


class TorrentResult(BaseModel):
    title: str
    magnet: str
    size: int
    seeders: int
    peers: int
    tracker: str = ""
    voices: list[str] = []
    quality: str | None = None
    videotype: str = ""
    pub_date: str = ""


class SearchResponse(BaseModel):
    uk: list[TorrentResult] = []
    ru: list[TorrentResult] = []
    en: list[TorrentResult] = []
    pl: list[TorrentResult] = []
    embed: dict | None = None


class AddTorrentRequest(BaseModel):
    magnet: str
    title: str = ""
    poster: str = ""


class StreamFile(BaseModel):
    name: str
    size: int
    file_id: int
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
    download_speed: float
    upload_speed: float
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
    torrent_hash:    str | None = None
    torrent_file_id: int | None = None
    torrent_fname:   str | None = None
    torrent_magnet:  str | None = None


class ProgressResponse(BaseModel):
    position_seconds: int
    torrent_hash:    str | None = None
    torrent_file_id: int | None = None
    torrent_fname:   str | None = None
    torrent_magnet:  str | None = None


class WatchHistoryItem(BaseModel):
    movie_id: str
    season: int | None
    episode: int | None
    position_seconds: int
    duration: int | None
    watched_at: str
    updated_at: str
    torrent_hash:    str | None = None
    torrent_file_id: int | None = None
    torrent_fname:   str | None = None
