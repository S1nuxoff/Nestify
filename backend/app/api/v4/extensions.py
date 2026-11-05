"""The extensions page: what exists, and what this account has installed."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v1.endpoints.auth import get_current_account
from app.api.v4.plugins import get_account_plugins, get_store
from app.models.accounts import Account
from app.plugins.account_plugins import AccountPluginStore
from app.plugins.store import PluginStore

router = APIRouter()

# Text for the page. Anything installed on the server that is not listed here uses its manifest.
DESCRIPTIONS = {
    "rezka": "Фільми та серіали з HDRezka: озвучки й субтитри.",
    "torrents": "Пошук торрентів українською, російською, англійською й польською.",
}
# Not plugins yet, shown so people see what exists and what is coming.
BUILT_IN = [
    {"id": "torrents", "name": "Торренти", "description": "Перегляд через торренти. Поки що вбудовані в Nestify.", "state": "builtin"},
    {"id": "subtitles", "name": "Субтитри", "description": "Додаткові субтитри для фільмів і серіалів.", "state": "soon"},
]


class InstallRequest(BaseModel):
    installed: bool


@router.get("/extensions")
async def list_extensions(
    account: Account = Depends(get_current_account),
    plugins: PluginStore = Depends(get_store),
    choices: AccountPluginStore = Depends(get_account_plugins),
):
    removed = await choices.removed(account.id)
    items = [
        {
            "id": plugin.id,
            "name": plugin.name,
            "description": DESCRIPTIONS.get(plugin.id) or plugin.manifest.get("description") or "",
            "state": "available" if plugin.id in removed else "installed",
        }
        for plugin in await plugins.list(enabled_only=True)
    ]
    running = {item["id"] for item in items}
    built_in = [item for item in BUILT_IN if item["id"] not in running]
    return {"items": items + built_in, "is_admin": await choices.is_admin(account.id)}


@router.put("/extensions/{plugin_id}", status_code=204)
async def set_installed(
    plugin_id: str,
    body: InstallRequest,
    account: Account = Depends(get_current_account),
    plugins: PluginStore = Depends(get_store),
    choices: AccountPluginStore = Depends(get_account_plugins),
):
    plugin = await plugins.get(plugin_id)
    if plugin is None or not plugin.enabled:
        raise HTTPException(404, "plugin not found")
    await choices.set_installed(account.id, plugin_id, body.installed)
