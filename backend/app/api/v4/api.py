from fastapi import APIRouter

from app.api.v4 import playback, plugins

api_router_v4 = APIRouter()
api_router_v4.include_router(plugins.router, tags=["Source plugins v4"])
api_router_v4.include_router(playback.router, tags=["Playback v4"])
