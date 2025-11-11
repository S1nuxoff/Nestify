# app/api/v1/endpoints/ws_live_session.py
from fastapi import WebSocket, APIRouter, WebSocketDisconnect
from app.websockets.manager import ws_manager

router = APIRouter()


@router.websocket("/ws/live_session/{user_id}")
async def live_session_ws(websocket: WebSocket, user_id: int):
    # 1. ОБОВʼЯЗКОВО accept
    await websocket.accept()

    # 2. Реєструємо підключення
    await ws_manager.connect(websocket, user_id)

    try:
        # 3. Одразу шлемо поточну сесію
        await ws_manager.broadcast_to_user(user_id)

        # 4. Тримаємо зʼєднання відкритим
        while True:
            # клієнт нічого не шле – це просто "блокер", щоб конект жив
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
