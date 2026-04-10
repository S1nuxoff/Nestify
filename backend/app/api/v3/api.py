from fastapi import APIRouter

from app.api.v3.endpoints import stream, history, hls, featured, tv

api_router_v3 = APIRouter()
api_router_v3.include_router(stream.router, prefix="/stream", tags=["Stream v3"])
api_router_v3.include_router(history.router, prefix="/watch", tags=["Watch History v3"])
api_router_v3.include_router(hls.router, prefix="/hls", tags=["HLS v3"])
api_router_v3.include_router(featured.router, tags=["Featured v3"])
api_router_v3.include_router(tv.router, prefix="/tv", tags=["TV Auth v3"])
