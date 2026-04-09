from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from typing import Any

from app.db.session import async_session
from app.models.accounts import Account
from app.models.app_settings import AppSettings
from app.models.users import User, UserRole
from app.api.v1.endpoints.auth import get_current_account
from app.core.config import settings

router = APIRouter()

# Settings exposed in admin panel with their metadata
ADMIN_SETTINGS_META: list[dict] = [
    # Jackett
    {"key": "JACKETT_URL",         "label": "Jackett URL",           "type": "text",     "group": "Jackett"},
    {"key": "JACKETT_KEY",         "label": "API Key",               "type": "password", "group": "Jackett"},
    {"key": "JACKETT_ENABLED",     "label": "Jackett Enabled",       "type": "bool",     "group": "Jackett"},
    {"key": "JACKETT_INDEXERS",    "label": "Indexers (comma)",      "type": "text",     "group": "Jackett"},
    {"key": "JACKETT_EN_INDEXERS", "label": "EN Indexers (comma)",   "type": "text",     "group": "Jackett"},
    {"key": "JACKETT_EN_ENABLED",  "label": "EN Enabled",            "type": "bool",     "group": "Jackett"},
    {"key": "JACKETT_PL_INDEXER",  "label": "PL Indexer",            "type": "text",     "group": "Jackett"},
    {"key": "JACKETT_PL_ENABLED",  "label": "PL Enabled",            "type": "bool",     "group": "Jackett"},
    # JacRed
    {"key": "JACRED_URL",          "label": "JacRed Public URL",     "type": "text",     "group": "JacRed"},
    {"key": "JACRED_ENABLED",      "label": "JacRed Public Enabled", "type": "bool",     "group": "JacRed"},
    {"key": "JACRED_OWN_URL",      "label": "JacRed Own URL",        "type": "text",     "group": "JacRed"},
    {"key": "JACRED_OWN_ENABLED",  "label": "JacRed Own Enabled",    "type": "bool",     "group": "JacRed"},
    # TorrServe
    {"key": "TORRSERVE_URL",       "label": "TorrServe URL",         "type": "text",     "group": "TorrServe"},
    # Rezka
    {"key": "REZKA_MIRROR",        "label": "Mirror domain",         "type": "text",     "group": "Rezka"},
    {"key": "REZKA_PROXY",         "label": "Proxy URL",             "type": "text",     "group": "Rezka"},
]

ALLOWED_KEYS = {m["key"] for m in ADMIN_SETTINGS_META}


def _serialize_value(key: str) -> Any:
    val = getattr(settings, key, "")
    if isinstance(val, bool):
        return val
    return str(val)


async def get_current_admin(account: Account = Depends(get_current_account)) -> Account:
    async with async_session() as session:
        result = await session.execute(
            select(User).where(
                User.account_id == account.id,
                User.role == UserRole.admin,
            )
        )
        admin_profile = result.scalar_one_or_none()
    if not admin_profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return account


@router.get("/settings")
async def get_settings(account: Account = Depends(get_current_admin)):
    """Return all admin-configurable settings with current values."""
    async with async_session() as session:
        rows = (await session.execute(select(AppSettings))).scalars().all()
    db_overrides = {r.key: r.value for r in rows}

    result = []
    for meta in ADMIN_SETTINGS_META:
        key = meta["key"]
        # DB override takes priority, fallback to in-memory settings
        raw = db_overrides.get(key)
        if raw is not None:
            if meta["type"] == "bool":
                value = raw.lower() in ("true", "1", "yes")
            else:
                value = raw
        else:
            value = _serialize_value(key)
        result.append({**meta, "value": value})

    return result


class SettingsPatch(BaseModel):
    updates: dict[str, Any]


@router.patch("/settings")
async def patch_settings(
    payload: SettingsPatch,
    account: Account = Depends(get_current_admin),
):
    """Update one or more settings. Applies immediately in-memory + persists to DB."""
    updates = {k: v for k, v in payload.updates.items() if k in ALLOWED_KEYS}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid keys provided")

    async with async_session() as session:
        for key, val in updates.items():
            str_val = str(val).lower() if isinstance(val, bool) else str(val)
            existing = await session.get(AppSettings, key)
            if existing:
                existing.value = str_val
            else:
                session.add(AppSettings(key=key, value=str_val))

            # Apply in-memory immediately
            current = getattr(settings, key, None)
            if isinstance(current, bool):
                setattr(settings, key, str(val).lower() in ("true", "1", "yes", "True"))
            elif isinstance(current, int):
                setattr(settings, key, int(val))
            else:
                setattr(settings, key, str(val))

        await session.commit()

    return {"ok": True, "updated": list(updates.keys())}
