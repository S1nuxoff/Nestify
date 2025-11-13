# app/websockets/player_hub.py
import json
from typing import Dict, Set, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

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
            print(f"[PlayerHub] player disconnected: {device_id}")

    async def register_controller(self, device_id: str, ws: WebSocket) -> None:
        self.controllers.setdefault(device_id, set()).add(ws)
        print(
            f"[PlayerHub] controller connected for {device_id}, total={len(self.controllers[device_id])}"
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

    def unregister_controller(self, device_id: str, ws: WebSocket) -> None:
        conns = self.controllers.get(device_id)
        if not conns:
            return
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.controllers.pop(device_id, None)
        print(f"[PlayerHub] controller disconnected for {device_id}")

    # ---------- обработка входящих сообщений -----------

    async def handle_from_player(self, device_id: str, raw: str) -> None:
        """
        Всё, что приходит от TV (ответы, нотификации) — тупо рассылаем всем контроллерам.
        """
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

    async def _send_json_safe(self, ws: WebSocket, obj: dict) -> None:
        try:
            await ws.send_json(obj)
        except Exception as e:
            print(f"[PlayerHub] send_json error: {e}")


player_hub = PlayerHub()


@router.websocket("/ws/player/{device_id}")
async def player_ws(websocket: WebSocket, device_id: str):
    """
    Подключается TV-приложение (Nestify Player).
    Оно будет получать JSON-RPC от бэка и слать назад ответы/нотификации.
    """
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
async def control_ws(websocket: WebSocket, device_id: str):
    """
    Подключается браузер (frontend).
    Фронт продолжает говорить JSON-RPC (Player.PlayUrl, Player.PlayPause и т.д.),
    мы просто прокидываем это на девайс с таким device_id.
    """
    await websocket.accept()
    await player_hub.register_controller(device_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            await player_hub.handle_from_controller(device_id, websocket, raw)
    except WebSocketDisconnect:
        player_hub.unregister_controller(device_id, websocket)
    except Exception as e:
        print(f"[Control WS] error for {device_id}: {e}")
        player_hub.unregister_controller(device_id, websocket)
