"""
HLS Session Manager
───────────────────
Генерує статичний VOD m3u8 на основі відомої тривалості + запускає FFmpeg.
Сегменти доступні через long-poll в endpoints/hls.py.
"""

import asyncio
import math
import os
import shutil
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from app.core.config import settings

_HLS_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "hls_cache")
)
HLS_TIME = 10  # довжина сегменту в секундах


# ── Сесія ────────────────────────────────────────────────────────────────────
@dataclass
class HlsSession:
    session_id: str
    temp_dir: str
    hash_: str
    file_id: int
    fname: str
    total_duration: float          # тривалість в секундах (з ffprobe / TMDB)
    time_offset: float = 0         # offset від початку файлу (для restart)
    process: Optional[asyncio.subprocess.Process] = None
    last_access: float = field(default_factory=time.time)


_sessions: dict[str, HlsSession] = {}
_cleanup_task: Optional[asyncio.Task] = None


# ── Статичний VOD m3u8 ───────────────────────────────────────────────────────
def _write_vod_m3u8(temp_dir: str, total_duration: float, time_offset: float = 0) -> None:
    """
    Записує повний m3u8 зразу — HLS.js бачить VOD з правильним скрубером.
    FFmpeg генерує сегменти у фоні, long-poll чекає кожен з них.
    """
    remaining = max(0, total_duration - time_offset)
    num_segments = math.ceil(remaining / HLS_TIME)

    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        f"#EXT-X-TARGETDURATION:{HLS_TIME}",
        "#EXT-X-PLAYLIST-TYPE:VOD",
        "#EXT-X-MEDIA-SEQUENCE:0",
    ]
    for i in range(num_segments):
        seg_dur = min(HLS_TIME, remaining - i * HLS_TIME)
        if seg_dur <= 0:
            break
        lines.append(f"#EXTINF:{seg_dur:.3f},")
        lines.append(f"seg_{i:04d}.ts")
    lines.append("#EXT-X-ENDLIST")

    m3u8_path = os.path.join(temp_dir, "stream.m3u8")
    with open(m3u8_path, "w") as f:
        f.write("\n".join(lines) + "\n")


# ── FFmpeg ───────────────────────────────────────────────────────────────────
async def _launch_ffmpeg(
    temp_dir: str, hash_: str, file_id: int, fname: str, t: float = 0
) -> asyncio.subprocess.Process:
    source_url = (
        f"{settings.TORRSERVE_URL}/stream/{fname}"
        f"?link={hash_}&index={file_id}&play"
    )
    segment_pattern = os.path.join(temp_dir, "seg_%04d.ts")
    # Пишемо в тимчасовий m3u8 — щоб не перезаписати наш статичний
    ffmpeg_m3u8 = os.path.join(temp_dir, "_ffmpeg.m3u8")

    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        *(["-ss", str(t)] if t > 0 else []),
        "-i", source_url,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        "-f", "hls",
        "-hls_time", str(HLS_TIME),
        "-hls_list_size", "0",
        "-hls_segment_filename", segment_pattern,
        ffmpeg_m3u8,          # FFmpeg пише свій m3u8 окремо, не чіпає наш VOD
    ]

    return await asyncio.create_subprocess_exec(
        *ffmpeg_cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )


# ── Запуск сесії ─────────────────────────────────────────────────────────────
async def start_session(
    hash_: str, file_id: int, fname: str, t: float = 0, duration: float = 0
) -> dict:
    session_id = str(uuid.uuid4())
    os.makedirs(_HLS_ROOT, exist_ok=True)
    temp_dir = tempfile.mkdtemp(prefix="sess_", dir=_HLS_ROOT)

    # Одразу пишемо статичний m3u8 щоб HLS.js міг стартувати
    if duration > 0:
        _write_vod_m3u8(temp_dir, duration, t)

    proc = await _launch_ffmpeg(temp_dir, hash_, file_id, fname, t)

    session = HlsSession(
        session_id=session_id,
        temp_dir=temp_dir,
        hash_=hash_, file_id=file_id, fname=fname,
        total_duration=duration,
        time_offset=t,
        process=proc,
    )
    _sessions[session_id] = session

    # Якщо duration невідомий — чекаємо поки FFmpeg створить свій m3u8
    # і генеруємо статичний на основі першого сегменту
    if duration <= 0:
        ffmpeg_m3u8 = os.path.join(temp_dir, "_ffmpeg.m3u8")
        for _ in range(40):
            if os.path.exists(ffmpeg_m3u8):
                break
            await asyncio.sleep(0.5)
        # fallback: хоча б один сегмент
        _write_vod_m3u8(temp_dir, 7200, t)  # 2 год як fallback

    playlist_url = f"{settings.API_BASE_URL}/api/v3/hls/{session_id}/stream.m3u8"
    return {"session_id": session_id, "playlist_url": playlist_url}


# ── Restart з нової позиції ───────────────────────────────────────────────────
async def restart_session(session_id: str, t: float) -> dict:
    session = _sessions.get(session_id)
    if not session:
        return {"error": "session not found"}

    if session.process:
        try:
            session.process.kill()
            await session.process.wait()
        except Exception:
            pass

    # Видаляємо старі сегменти
    for f in os.listdir(session.temp_dir):
        if f.endswith(".ts") or f == "_ffmpeg.m3u8":
            try:
                os.remove(os.path.join(session.temp_dir, f))
            except Exception:
                pass

    # Пишемо новий статичний m3u8 для нової позиції
    session.time_offset = t
    if session.total_duration > 0:
        _write_vod_m3u8(session.temp_dir, session.total_duration, t)

    session.process = await _launch_ffmpeg(
        session.temp_dir, session.hash_, session.file_id, session.fname, t
    )
    session.last_access = time.time()
    return {"ok": True}


# ── Helpers ──────────────────────────────────────────────────────────────────
def get_session(session_id: str) -> Optional[HlsSession]:
    session = _sessions.get(session_id)
    if session:
        session.last_access = time.time()
    return session


async def stop_session(session_id: str) -> None:
    session = _sessions.pop(session_id, None)
    if not session:
        return
    if session.process:
        try:
            session.process.kill()
            await session.process.wait()
        except Exception:
            pass
    if os.path.exists(session.temp_dir):
        shutil.rmtree(session.temp_dir, ignore_errors=True)


# ── Авто-cleanup ──────────────────────────────────────────────────────────────
async def _cleanup_loop(max_idle: int = 300) -> None:
    while True:
        await asyncio.sleep(60)
        now = time.time()
        expired = [sid for sid, s in list(_sessions.items()) if now - s.last_access > max_idle]
        for sid in expired:
            print(f"[HLS] cleanup expired session {sid}", flush=True)
            await stop_session(sid)


def start_cleanup_task() -> None:
    global _cleanup_task
    if _cleanup_task is None or _cleanup_task.done():
        _cleanup_task = asyncio.create_task(_cleanup_loop())
