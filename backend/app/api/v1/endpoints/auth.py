from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db.session import async_session
from app.models.accounts import Account
from app.models.liked_movies import LikedMovie
from app.models.sessions import Session
from app.models.users import User
from app.models.watch_history import WatchHistory
from app.services.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.services.user.create_user import create_user
from app.services.user.get_users import get_all_users

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    profile_name: str = Field(..., min_length=1, max_length=50)
    avatar_url: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class CreateProfileRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    avatar_url: str | None = None
    pin_code: str | None = Field(None, max_length=10)


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    avatar_url: str | None = Field(None, max_length=255)
    default_lang: str | None = Field(None, pattern="^(best|uk|ru|en|pl)$")


class UpdateAccountRequest(BaseModel):
    display_name: str | None = Field(None, max_length=80)
    avatar_url: str | None = Field(None, max_length=255)


def serialize_profile(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "kodi_address": user.kodi_address,
        "account_id": user.account_id,
        "default_lang": getattr(user, "default_lang", "best") or "best",
    }


def serialize_account(account: Account) -> dict:
    return {
        "id": account.id,
        "email": account.email,
        "display_name": account.display_name,
        "avatar_url": account.avatar_url,
        "is_active": account.is_active,
        "created_at": account.created_at,
    }


async def get_current_account(
    authorization: str | None = Header(default=None),
) -> Account:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    account_id = int(payload["sub"])

    async with async_session() as session:
        result = await session.execute(
            select(Account).where(Account.id == account_id, Account.is_active.is_(True))
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found",
            )
        return account


@router.post("/register")
async def register(payload: RegisterRequest):
    async with async_session() as session:
        async with session.begin():
            existing = await session.execute(
                select(Account).where(Account.email == payload.email.lower().strip())
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Account with this email already exists",
                )

            account = Account(
                email=payload.email.lower().strip(),
                display_name=payload.profile_name.strip(),
                password_hash=hash_password(payload.password),
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(account)
            await session.flush()

        await session.commit()
        await session.refresh(account)

    profile = await create_user(
        name=payload.profile_name,
        avatar_url=payload.avatar_url,
        account_id=account.id,
    )
    profiles = await get_all_users(account.id)

    return {
        "access_token": create_access_token(account.id),
        "token_type": "bearer",
        "account": serialize_account(account),
        "profiles": [serialize_profile(item) for item in profiles],
        "selected_profile": serialize_profile(profile),
    }


@router.post("/login")
async def login(payload: LoginRequest):
    async with async_session() as session:
        result = await session.execute(
            select(Account).where(Account.email == payload.email.lower().strip())
        )
        account = result.scalar_one_or_none()

    if not account or not verify_password(payload.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    profiles = await get_all_users(account.id)

    return {
        "access_token": create_access_token(account.id),
        "token_type": "bearer",
        "account": serialize_account(account),
        "profiles": [serialize_profile(item) for item in profiles],
    }


@router.get("/me")
async def get_me(account: Account = Depends(get_current_account)):
    profiles = await get_all_users(account.id)
    return {
        "account": serialize_account(account),
        "profiles": [serialize_profile(item) for item in profiles],
    }


@router.post("/profiles")
async def create_profile(
    payload: CreateProfileRequest,
    account: Account = Depends(get_current_account),
):
    try:
        profile = await create_user(
            name=payload.name,
            avatar_url=payload.avatar_url,
            pin_code=payload.pin_code,
            account_id=account.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error",
        ) from exc

    return serialize_profile(profile)


@router.patch("/me")
async def update_me(
    payload: UpdateAccountRequest,
    account: Account = Depends(get_current_account),
):
    async with async_session() as session:
        result = await session.execute(select(Account).where(Account.id == account.id))
        db_account = result.scalar_one_or_none()
        if not db_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )

        display_name = (payload.display_name or "").strip() or None
        db_account.display_name = display_name
        db_account.avatar_url = payload.avatar_url
        db_account.updated_at = datetime.utcnow()

        await session.commit()
        await session.refresh(db_account)

    return serialize_account(db_account)


@router.patch("/profiles/{profile_id}")
async def update_profile(
    profile_id: int,
    payload: UpdateProfileRequest,
    account: Account = Depends(get_current_account),
):
    async with async_session() as session:
        result = await session.execute(
            select(User).where(
                User.id == profile_id,
                User.account_id == account.id,
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found",
            )

        if payload.name is not None:
            profile.name = payload.name.strip()
        if payload.avatar_url is not None:
            profile.avatar_url = payload.avatar_url
        if payload.default_lang is not None:
            profile.default_lang = payload.default_lang
        profile.updated_at = datetime.utcnow()

        try:
            await session.commit()
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Profile with this name already exists",
            ) from exc

        await session.refresh(profile)

    return serialize_profile(profile)


@router.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: int,
    account: Account = Depends(get_current_account),
):
    try:
        async with async_session() as session:
            result = await session.execute(
                select(User).where(
                    User.id == profile_id,
                    User.account_id == account.id,
                )
            )
            profile = result.scalar_one_or_none()

            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Profile not found",
                )

            profiles_count_result = await session.execute(
                select(User.id).where(User.account_id == account.id)
            )
            profile_ids = profiles_count_result.scalars().all()

            if len(profile_ids) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot delete the last profile in the account",
                )

            await session.execute(
                delete(WatchHistory).where(WatchHistory.user_id == profile.id)
            )
            await session.execute(
                delete(LikedMovie).where(LikedMovie.user_id == profile.id)
            )
            await session.execute(delete(Session).where(Session.user_id == profile.id))

            await session.delete(profile)
            await session.commit()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile cannot be deleted because it still has linked data",
        ) from exc

    return {"deleted": True, "profile_id": profile_id}
