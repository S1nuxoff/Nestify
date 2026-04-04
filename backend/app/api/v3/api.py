from fastapi import APIRouter

from app.api.v3.endpoints import torrents, history

api_router_v3 = APIRouter()
api_router_v3.include_router(torrents.router, prefix="/torrents", tags=["Torrents v3"])
api_router_v3.include_router(history.router, prefix="/watch", tags=["Watch History v3"])
