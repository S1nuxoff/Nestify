"""The extensions page: what exists, and what this account has installed."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.v1.endpoints.admin import get_current_admin
from app.api.v1.endpoints.auth import get_current_account
from app.api.v4.plugins import get_account_plugins, get_plugin_client, get_store
from app.models.accounts import Account
from app.plugins.account_plugins import AccountPluginStore
from app.plugins.client import PluginClient, PluginError
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
    client: PluginClient = Depends(get_plugin_client),
):
    removed = await choices.removed(account.id)
    running = await plugins.list(enabled_only=True)
    is_admin = await choices.is_admin(account.id)
    items = [
        {
            "id": plugin.id,
            "name": plugin.name,
            "version": plugin.version,
            "description": DESCRIPTIONS.get(plugin.id) or plugin.manifest.get("description") or "",
            "state": "available" if plugin.id in removed else "installed",
        }
        for plugin in running
    ]
    if is_admin:
        # Plugins without settings answer with an error here, which just means no settings button.
        settings = await asyncio.gather(
            *(client.settings(p.base_url, p.token) for p in running), return_exceptions=True,
        )
        for item, result in zip(items, settings):
            if not isinstance(result, BaseException):
                item["configurable"] = True
                item["status"] = result.status.model_dump()
    ids = {item["id"] for item in items}
    built_in = [item for item in BUILT_IN if item["id"] not in ids]
    return {"items": items + built_in, "is_admin": is_admin}


class SettingsRequest(BaseModel):
    values: dict[str, str] = Field(max_length=20)


async def _running_plugin(plugin_id: str, plugins: PluginStore):
    plugin = await plugins.get(plugin_id)
    if plugin is None or not plugin.enabled:
        raise HTTPException(404, "plugin not found")
    return plugin


@router.get("/extensions/{plugin_id}/settings")
async def get_settings(
    plugin_id: str,
    _: Account = Depends(get_current_admin),
    plugins: PluginStore = Depends(get_store),
    client: PluginClient = Depends(get_plugin_client),
):
    plugin = await _running_plugin(plugin_id, plugins)
    try:
        return (await client.settings(plugin.base_url, plugin.token)).model_dump()
    except PluginError as exc:
        raise HTTPException(502, str(exc)) from exc


@router.put("/extensions/{plugin_id}/settings")
async def save_settings(
    plugin_id: str,
    body: SettingsRequest,
    _: Account = Depends(get_current_admin),
    plugins: PluginStore = Depends(get_store),
    client: PluginClient = Depends(get_plugin_client),
):
    plugin = await _running_plugin(plugin_id, plugins)
    try:
        return (await client.save_settings(plugin.base_url, plugin.token, body.values)).model_dump()
    except PluginError as exc:
        raise HTTPException(400, str(exc)) from exc


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
