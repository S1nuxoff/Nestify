from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete

from app.core.config import settings
from app.db.session import async_session
from app.models.accounts import Account
from app.models.tv_device import TvDevice, TvLoginToken
from app.models.users import User
from app.services.auth import create_access_token, decode_access_token

router = APIRouter()

QR_TOKEN_TTL_MINUTES = 5


# ── TMDB config (no auth required — key is public-safe read-only) ─────────────

@router.get("/tmdb-config", summary="Return TMDB API key for TV app")
async def tmdb_config(authorization: str | None = Header(default=None)):
    await _get_account_by_token(authorization)
    return {
        "tmdb_key": settings.TMDB_KEY,
        "tmdb_base": settings.TMDB_BASE,
        "tmdb_img": settings.TMDB_IMG,
    }


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_account_by_token(authorization: str | None) -> Account:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_access_token(token)
        account_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    async with async_session() as session:
        account = (await session.execute(
            select(Account).where(Account.id == account_id, Account.is_active.is_(True))
        )).scalar_one_or_none()
    if not account:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Account not found")
    return account


# ── Schemas ───────────────────────────────────────────────────────────────────

class TvRegisterRequest(BaseModel):
    device_id: str
    profile_id: int
    device_name: str = "Мій телевізор"


class TvQrCreateRequest(BaseModel):
    device_id: str
    device_name: str = "Телевізор"


class TvQrConfirmRequest(BaseModel):
    profile_id: int


class TvLoginRequest(BaseModel):
    email: str
    password: str
    device_id: str
    device_name: str = "Мій телевізор"


class TvLogoutRequest(BaseModel):
    device_id: str


class TvPlayRequest(BaseModel):
    device_id: str
    url: str
    link: str | None = None
    origin_name: str | None = None
    title: str | None = None
    image: str | None = None
    movie_id: str | None = None
    season: int | None = None
    episode: int | None = None
    user_id: str | None = None
    position_ms: int | None = None


# ── Register device ───────────────────────────────────────────────────────────

@router.post("/register", summary="Register TV device to account")
async def tv_register(
    body: TvRegisterRequest,
    authorization: str | None = Header(default=None),
):
    account = await _get_account_by_token(authorization)

    async with async_session() as session:
        async with session.begin():
            # Verify profile belongs to this account
            profile = (await session.execute(
                select(User).where(User.id == body.profile_id, User.account_id == account.id)
            )).scalar_one_or_none()
            if not profile:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Profile not found")

            existing = (await session.execute(
                select(TvDevice).where(TvDevice.device_id == body.device_id)
            )).scalar_one_or_none()

            if existing:
                existing.account_id = account.id
                existing.profile_id = body.profile_id
                existing.device_name = body.device_name
                existing.is_logged_in = True
                existing.logged_out_at = None
                existing.last_seen_at = datetime.now(timezone.utc)
            else:
                session.add(TvDevice(
                    device_id=body.device_id,
                    account_id=account.id,
                    profile_id=body.profile_id,
                    device_name=body.device_name,
                    is_logged_in=True,
                    logged_out_at=None,
                    last_seen_at=datetime.now(timezone.utc),
                    created_at=datetime.now(timezone.utc),
                ))

    return {"ok": True}


@router.post("/logout", summary="Mark TV device as logged out")
async def tv_logout(
    body: TvLogoutRequest,
    authorization: str | None = Header(default=None),
):
    account = await _get_account_by_token(authorization)
    now = datetime.now(timezone.utc)

    async with async_session() as session:
        async with session.begin():
            device = (
                await session.execute(
                    select(TvDevice).where(
                        TvDevice.device_id == body.device_id,
                        TvDevice.account_id == account.id,
                    )
                )
            ).scalar_one_or_none()
            if not device:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="TV device not found")

            device.is_logged_in = False
            device.logged_out_at = now
            device.last_seen_at = now

    from app.websockets.player_hub import player_hub

    await player_hub.disconnect_device(body.device_id, reason="Device logged out")
    return {"ok": True}


@router.delete("/unregister", summary="Unregister TV device")
async def tv_unregister(
    device_id: str,
    authorization: str | None = Header(default=None),
):
    account = await _get_account_by_token(authorization)
    async with async_session() as session:
        async with session.begin():
            await session.execute(
                delete(TvDevice).where(
                    TvDevice.device_id == device_id,
                    TvDevice.account_id == account.id,
                )
            )
    return {"ok": True}


# ── Online TVs ────────────────────────────────────────────────────────────────

@router.get("/online", summary="Get online TV devices for account")
async def tv_online(authorization: str | None = Header(default=None)):
    account = await _get_account_by_token(authorization)

    async with async_session() as session:
        devices = (await session.execute(
            select(TvDevice, User)
            .join(User, TvDevice.profile_id == User.id)
            .where(TvDevice.account_id == account.id)
        )).all()

    # Import here to avoid circular import
    from app.websockets.player_hub import player_hub

    result = []
    for device, profile in devices:
        if device.is_logged_in and device.device_id in player_hub.players:
            result.append({
                "device_id": device.device_id,
                "device_name": device.device_name,
                "profile_id": profile.id,
                "profile_name": profile.name,
                "profile_avatar": profile.avatar_url,
                "is_logged_in": device.is_logged_in,
            })

    return result


# ── All registered devices (with online flag) ────────────────────────────────

@router.get("/devices", summary="Get all registered TV devices for account with online status")
async def tv_devices(authorization: str | None = Header(default=None)):
    account = await _get_account_by_token(authorization)

    async with async_session() as session:
        rows = (await session.execute(
            select(TvDevice, User)
            .join(User, TvDevice.profile_id == User.id)
            .where(TvDevice.account_id == account.id)
        )).all()

    from app.websockets.player_hub import player_hub

    return [
        {
            "device_id": device.device_id,
            "device_name": device.device_name,
            "profile_id": profile.id,
            "profile_name": profile.name,
            "profile_avatar": profile.avatar_url,
            "online": device.is_logged_in and device.device_id in player_hub.players,
            "playing": player_hub.is_playing(device.device_id),
            "is_logged_in": device.is_logged_in,
            "logged_out_at": device.logged_out_at.isoformat() if device.logged_out_at else None,
            "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
        }
        for device, profile in rows
    ]


@router.post("/play", summary="Send playback command to TV device via backend hub")
async def tv_play(
    body: TvPlayRequest,
    authorization: str | None = Header(default=None),
):
    account = await _get_account_by_token(authorization)

    async with async_session() as session:
        row = (
            await session.execute(
                select(TvDevice, User)
                .join(User, TvDevice.profile_id == User.id)
                .where(
                    TvDevice.device_id == body.device_id,
                    TvDevice.account_id == account.id,
                    TvDevice.is_logged_in.is_(True),
                )
            )
        ).first()

    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="TV device not found")

    device, profile = row

    from app.websockets.player_hub import player_hub

    ok = await player_hub.send_rpc_to_player(
        body.device_id,
        "Player.PlayUrl",
        {
            "url": body.url,
            "link": body.link,
            "origin_name": body.origin_name,
            "title": body.title,
            "image": body.image,
            "movie_id": body.movie_id,
            "season": body.season,
            "episode": body.episode,
            "user_id": body.user_id or str(profile.id),
            "position_ms": body.position_ms,
        },
    )
    if not ok:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="TV device is offline")

    return {"ok": True}


# ── Profiles for current account ─────────────────────────────────────────────

@router.get("/profiles", summary="Get all profiles for the authenticated account")
async def tv_profiles(authorization: str | None = Header(default=None)):
    account = await _get_account_by_token(authorization)
    async with async_session() as session:
        profiles = (await session.execute(
            select(User).where(User.account_id == account.id, User.is_active.is_(True))
        )).scalars().all()
    return [{"id": p.id, "name": p.name, "avatar_url": p.avatar_url} for p in profiles]


# ── Email/password login on TV ────────────────────────────────────────────────

@router.post("/login", summary="TV login with email and password")
async def tv_login(body: TvLoginRequest):
    from app.services.auth import verify_password

    async with async_session() as session:
        account = (await session.execute(
            select(Account).where(Account.email == body.email.lower().strip())
        )).scalar_one_or_none()

    if not account or not verify_password(body.password, account.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Невірний email або пароль")
    if not account.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Акаунт заблокований")

    auth_token = create_access_token(account.id)

    async with async_session() as session:
        profiles = (await session.execute(
            select(User).where(User.account_id == account.id, User.is_active.is_(True))
        )).scalars().all()

    return {
        "auth_token": auth_token,
        "account": {
            "id": account.id,
            "email": account.email,
            "display_name": account.display_name,
        },
        "profiles": [
            {"id": p.id, "name": p.name, "avatar_url": p.avatar_url}
            for p in profiles
        ],
    }


# ── QR login flow ─────────────────────────────────────────────────────────────

@router.post("/qr/create", summary="TV requests a QR login token")
async def qr_create(body: TvQrCreateRequest):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=QR_TOKEN_TTL_MINUTES)

    async with async_session() as session:
        async with session.begin():
            # Clean up old expired tokens for this device
            await session.execute(
                delete(TvLoginToken).where(TvLoginToken.device_id == body.device_id)
            )
            session.add(TvLoginToken(
                token=token,
                device_id=body.device_id,
                device_name=body.device_name,
                confirmed=False,
                expires_at=expires_at,
                created_at=datetime.now(timezone.utc),
            ))

    qr_url = f"{settings.FRONTEND_BASE_URL}/tv-login?token={token}"
    return {"token": token, "qr_url": qr_url, "expires_in": QR_TOKEN_TTL_MINUTES * 60}


@router.get("/qr/info/{token}", summary="Get QR token info for confirmation page")
async def qr_info(token: str):
    async with async_session() as session:
        row = (await session.execute(
            select(TvLoginToken).where(TvLoginToken.token == token)
        )).scalar_one_or_none()

    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Token not found")
    if row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_410_GONE, detail="Token expired")
    if row.confirmed:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Already confirmed")

    return {
        "device_name": row.device_name,
        "expires_at": row.expires_at.isoformat(),
    }


@router.post("/qr/confirm/{token}", summary="User confirms QR login from website")
async def qr_confirm(token: str, body: TvQrConfirmRequest, authorization: str | None = Header(default=None)):
    account = await _get_account_by_token(authorization)

    async with async_session() as session:
        async with session.begin():
            row = (await session.execute(
                select(TvLoginToken).where(TvLoginToken.token == token)
            )).scalar_one_or_none()

            if not row:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Token not found")
            if row.expires_at < datetime.now(timezone.utc):
                raise HTTPException(status.HTTP_410_GONE, detail="Token expired")
            if row.confirmed:
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Already confirmed")

            # Verify profile belongs to this account
            profile = (await session.execute(
                select(User).where(User.id == body.profile_id, User.account_id == account.id)
            )).scalar_one_or_none()
            if not profile:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Profile not found")

            auth_token = create_access_token(account.id)

            row.confirmed = True
            row.account_id = account.id
            row.profile_id = body.profile_id
            row.auth_token = auth_token

    return {"ok": True}


@router.get("/qr/poll/{token}", summary="TV polls for QR confirmation result")
async def qr_poll(token: str):
    async with async_session() as session:
        row = (await session.execute(
            select(TvLoginToken).where(TvLoginToken.token == token)
        )).scalar_one_or_none()

    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Token not found")
    if row.expires_at < datetime.now(timezone.utc):
        return {"confirmed": False, "expired": True}
    if not row.confirmed:
        return {"confirmed": False, "expired": False}

    # Confirmed — return auth info
    async with async_session() as session:
        profile = (await session.execute(
            select(User).where(User.id == row.profile_id)
        )).scalar_one_or_none()
        account = (await session.execute(
            select(Account).where(Account.id == row.account_id)
        )).scalar_one_or_none()
        # Get all profiles for profile picker
        profiles = (await session.execute(
            select(User).where(User.account_id == row.account_id, User.is_active.is_(True))
        )).scalars().all()

    return {
        "confirmed": True,
        "auth_token": row.auth_token,
        "account": {
            "id": account.id,
            "email": account.email,
            "display_name": account.display_name,
        },
        "profiles": [
            {"id": p.id, "name": p.name, "avatar_url": p.avatar_url}
            for p in profiles
        ],
    }
