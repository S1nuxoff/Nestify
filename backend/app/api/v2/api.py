from fastapi import APIRouter
from app.api.v2 import stream

api_router_v2 = APIRouter()
api_router_v2.include_router(stream.router, prefix="/stream", tags=["Stream v2"])
