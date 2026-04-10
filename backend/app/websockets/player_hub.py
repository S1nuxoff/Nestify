# app/websockets/player_hub.py
import json
from typing import Dict, Set, Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.db.session import async_session
from app.models.tv_device import TvDevice

router = APIRouter()


class PlayerHub:
    """
    Хаб, который:
    - держит соединения TV-плееров (device_id -> WebSocket)
    - держит соединения контроллеров (device_id -> set[WebSocket])
    - прокидывает JSON-RPC между ними
    """

    def __init__(self) -> None:
        # один активный плеер на device_id
        self.players: Dict[str, WebSocket] = {}
        # несколько контроллеров (браузеры) на один device_id
        self.controllers: Dict[str, Set[WebSocket]] = {}
        # playing state per device (True = currently playing video)
        self.playing: Dict[str, bool] = {}

    def is_playing(self, device_id: str) -> bool:
        return self.playing.get(device_id, False)

    async def disconnect_device(self, device_id: str, *, code: int = 4001, reason: str = "Device logged out") -> None:
        player_ws = self.players.pop(device_id, None)
        self.playing.pop(device_id, None)
        if player_ws is not None:
            try:
                await player_ws.close(code=code, reason=reason)
            except Exception:
                pass

        controllers = self.controllers.pop(device_id, set())
        for ws in controllers:
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass

    async def send_rpc_to_player(self, device_id: str, method: str, params: dict) -> bool:
        player_ws: Optional[WebSocket] = self.players.get(device_id)
        if player_ws is None:
            return False
        try:
            await player_ws.send_json(
                {
                    "jsonrpc": "2.0",
                    "method": method,
                    "params": params,
                }
            )
            return True
        except Exception as e:
            print(f"[PlayerHub] error send_rpc_to_player {device_id}: {e}")
            self.players.pop(device_id, None)
            self.playing.pop(device_id, None)
            await self._notify_controllers_device_status(device_id, online=False)
            return False

    # ---------- регистрация / снятие -----------

    async def register_player(self, device_id: str, ws: WebSocket) -> None:
        # если уже был плеер — закрываем старый
        old = self.players.get(device_id)
        if old is not None and old is not ws:
            try:
                await old.close(code=4000)
            except Exception:
                pass
        self.players[device_id] = ws
        print(f"[PlayerHub] player connected: {device_id}")

        # уведомим контроллеров, что плеер онлайн
        await self._notify_controllers_device_status(device_id, online=True)

    def unregister_player(self, device_id: str, ws: WebSocket) -> None:
        current = self.players.get(device_id)
        if current is ws:
            self.players.pop(device_id, None)
            self.playing.pop(device_id, None)
            print(f"[PlayerHub] player disconnected: {device_id}")

    async def register_controller(self, device_id: str, ws: WebSocket, profile_name: str = "", avatar_url: str = "", user_id: str = "") -> None:
        self.controllers.setdefault(device_id, set()).add(ws)
        print(
            f"[PlayerHub] controller connected for {device_id} profile={profile_name!r}, user_id={user_id!r}, total={len(self.controllers[device_id])}"
        )

        # при коннекте сразу скажем, онлайн ли плеер
        online = device_id in self.players
        await self._send_json_safe(
            ws,
            {
                "jsonrpc": "2.0",
                "method": "PlayerHub.DeviceStatus",
                "params": {"device_id": device_id, "online": online},
            },
        )

        # уведомим TV-плеер что контроллер подключился
        await self._notify_player(
            device_id,
            {
                "jsonrpc": "2.0",
                "method": "PlayerHub.ControllerConnected",
                "params": {"profile_name": profile_name or "", "avatar_url": avatar_url or "", "user_id": user_id or ""},
            },
        )

    async def unregister_controller(self, device_id: str, ws: WebSocket) -> None:
        conns = self.controllers.get(device_id)
        if not conns:
            return
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.controllers.pop(device_id, None)
        print(f"[PlayerHub] controller disconnected for {device_id}")

        # если контроллеров больше нет — уведомим TV
        remaining = len(self.controllers.get(device_id) or [])
        if remaining == 0:
            await self._notify_player(
                device_id,
                {
                    "jsonrpc": "2.0",
                    "method": "PlayerHub.ControllerDisconnected",
                    "params": {},
                },
            )

    # ---------- обработка входящих сообщений -----------

    async def handle_from_player(self, device_id: str, raw: str) -> None:
        """
        Всё, что приходит от TV (ответы, нотификации) — тупо рассылаем всем контроллерам.
        Также отслеживаем состояние воспроизведения.
        """
        try:
            msg = json.loads(raw)
            method = msg.get("method", "")
            if method == "Player.OnPlay":
                self.playing[device_id] = True
            elif method in ("Player.OnStop", "Player.OnEnd"):
                self.playing[device_id] = False
        except Exception:
            pass

        conns = self.controllers.get(device_id)
        if not conns:
            return

        dead: Set[WebSocket] = set()
        for ws in conns:
            try:
                await ws.send_text(raw)
            except Exception as e:
                print(f"[PlayerHub] error send to controller for {device_id}: {e}")
                dead.add(ws)

        for ws in dead:
            conns.discard(ws)
        if not conns:
            self.controllers.pop(device_id, None)

    async def handle_from_controller(
        self, device_id: str, ws: WebSocket, raw: str
    ) -> None:
        """
        Контроллер шлёт JSON-RPC (как сейчас фронт шлёт на прямой WS плеера).
        Мы:
        - если плеер есть — просто пересылаем ему raw как есть.
        - если плеера нет и есть id — шлём назад JSON-RPC error.
        """
        player_ws: Optional[WebSocket] = self.players.get(device_id)
        if player_ws is None:
            # попробуем вытащить id, чтобы красиво ответить ошибкой
            try:
                msg = json.loads(raw)
            except Exception:
                # не JSON — игнор
                return

            rpc_id = msg.get("id")
            if rpc_id is not None:
                error_obj = {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32001,
                        "message": "Player is offline",
                    },
                }
                await self._send_json_safe(ws, error_obj)
            return

        # плеер жив — просто прокидываем
        try:
            await player_ws.send_text(raw)
        except Exception as e:
            print(f"[PlayerHub] error send to player {device_id}: {e}")
            # считаем, что плеер отвалился
            self.players.pop(device_id, None)
            await self._notify_controllers_device_status(device_id, online=False)

    # ---------- хелперы -----------

    async def _notify_controllers_device_status(
        self, device_id: str, online: bool
    ) -> None:
        """
        Шлем всем контроллерам нотификацию о том, что девайс онлайн/оффлайн.
        """
        conns = self.controllers.get(device_id)
        if not conns:
            return

        payload = {
            "jsonrpc": "2.0",
            "method": "PlayerHub.DeviceStatus",
            "params": {"device_id": device_id, "online": online},
        }

        dead: Set[WebSocket] = set()
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception as e:
                print(f"[PlayerHub] error notify status for {device_id}: {e}")
                dead.add(ws)

        for ws in dead:
            conns.discard(ws)
        if not conns:
            self.controllers.pop(device_id, None)

    async def _notify_player(self, device_id: str, obj: dict) -> None:
        player_ws = self.players.get(device_id)
        if player_ws is None:
            return
        try:
            await player_ws.send_json(obj)
        except Exception as e:
            print(f"[PlayerHub] error notify player {device_id}: {e}")

    async def _send_json_safe(self, ws: WebSocket, obj: dict) -> None:
        try:
            await ws.send_json(obj)
        except Exception as e:
            print(f"[PlayerHub] send_json error: {e}")


player_hub = PlayerHub()


async def _get_logged_in_device(device_id: str) -> Optional[TvDevice]:
    async with async_session() as session:
        return (
            await session.execute(
                select(TvDevice).where(
                    TvDevice.device_id == device_id,
                    TvDevice.is_logged_in.is_(True),
                )
            )
        ).scalar_one_or_none()


@router.websocket("/ws/player/{device_id}")
async def player_ws(websocket: WebSocket, device_id: str):
    """
    Подключается TV-приложение (Nestify Player).
    Оно будет получать JSON-RPC от бэка и слать назад ответы/нотификации.
    """
    device = await _get_logged_in_device(device_id)
    if device is None:
        await websocket.close(code=4403, reason="Device is logged out")
        return

    await websocket.accept()
    await player_hub.register_player(device_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            await player_hub.handle_from_player(device_id, raw)
    except WebSocketDisconnect:
        player_hub.unregister_player(device_id, websocket)
        # уведомим контроллеров
        await player_hub._notify_controllers_device_status(device_id, online=False)
    except Exception as e:
        print(f"[Player WS] error for {device_id}: {e}")
        player_hub.unregister_player(device_id, websocket)
        await player_hub._notify_controllers_device_status(device_id, online=False)


@router.websocket("/ws/control/{device_id}")
async def control_ws(
    websocket: WebSocket,
    device_id: str,
    profile: str = Query(default=""),
    avatar: str = Query(default=""),
    user_id: str = Query(default=""),
):
    """
    Подключается браузер (frontend).
    Фронт продолжает говорить JSON-RPC (Player.PlayUrl, Player.PlayPause и т.д.),
    мы просто прокидываем это на девайс с таким device_id.
    """
    device = await _get_logged_in_device(device_id)
    if device is None:
        await websocket.close(code=4404, reason="Device is unavailable")
        return

    await websocket.accept()
    await player_hub.register_controller(device_id, websocket, profile_name=profile, avatar_url=avatar, user_id=user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            await player_hub.handle_from_controller(device_id, websocket, raw)
    except WebSocketDisconnect:
        await player_hub.unregister_controller(device_id, websocket)
    except Exception as e:
        print(f"[Control WS] error for {device_id}: {e}")
        await player_hub.unregister_controller(device_id, websocket)
