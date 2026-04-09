from fastapi import APIRouter
from app.api.v1.endpoints import auth, rezka, session, utils, user, admin


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(rezka.router, prefix="/rezka", tags=["Rezka"])
api_router.include_router(session.router, prefix="/session", tags=["Sesion"])
api_router.include_router(utils.router, prefix="/utils", tags=["Utils"])
api_router.include_router(user.router, prefix="/user", tags=["User"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
