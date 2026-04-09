import asyncio
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.services import hls_manager

router = APIRouter()


@router.post("/start")
async def start_hls(
    hash: str = Query(...),
    file_index: int = Query(...),
    fname: str = Query(...),
    t: float = Query(0),
    duration: float = Query(0),
):
    result = await hls_manager.start_session(hash, file_index, fname, t=t, duration=duration)
    return result


@router.post("/{session_id}/restart")
async def restart_hls(session_id: str, t: float = Query(...)):
    result = await hls_manager.restart_session(session_id, t)
    return result


@router.get("/{session_id}/stream.m3u8")
async def get_playlist(session_id: str):
    session = hls_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    m3u8_path = os.path.join(session.temp_dir, "stream.m3u8")
    if not os.path.exists(m3u8_path):
        raise HTTPException(404, "Playlist not ready yet")
    return FileResponse(
        m3u8_path,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-cache, no-store"},
    )


@router.get("/{session_id}/{segment}")
async def get_segment(session_id: str, segment: str):
    if not segment.endswith(".ts") or "/" in segment or ".." in segment:
        raise HTTPException(400, "Invalid segment name")

    session = hls_manager.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    seg_path = os.path.join(session.temp_dir, segment)

    # Long-poll: чекаємо поки FFmpeg допише сегмент.
    # Сегмент вважається готовим коли він з'явився в _ffmpeg.m3u8
    # (FFmpeg дописав і перейшов до наступного).
    ffmpeg_m3u8 = os.path.join(session.temp_dir, "_ffmpeg.m3u8")
    for _ in range(60):  # макс 30 сек
        if os.path.exists(seg_path) and os.path.getsize(seg_path) > 0:
            if os.path.exists(ffmpeg_m3u8):
                try:
                    if segment in open(ffmpeg_m3u8).read():
                        return FileResponse(seg_path, media_type="video/mp2t")
                except Exception:
                    pass
        await asyncio.sleep(0.5)

    # Якщо сегмент є на диску але не в _ffmpeg.m3u8 ще — спробуємо повернути
    if os.path.exists(seg_path) and os.path.getsize(seg_path) > 1000:
        return FileResponse(seg_path, media_type="video/mp2t")

    raise HTTPException(408, "Segment not ready in time")


@router.delete("/{session_id}")
async def stop_hls(session_id: str):
    await hls_manager.stop_session(session_id)
    return {"ok": True}
