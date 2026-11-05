from sqlalchemy import select

from app.db.session import async_session
from app.models.source_plugin import SourcePlugin


class PluginStore:
    async def list(self, enabled_only: bool = False) -> list[SourcePlugin]:
        query = select(SourcePlugin).order_by(SourcePlugin.name)
        if enabled_only:
            query = query.where(SourcePlugin.enabled.is_(True))
        async with async_session() as session:
            return list((await session.execute(query)).scalars().all())

    async def get(self, plugin_id: str) -> SourcePlugin | None:
        async with async_session() as session:
            return await session.get(SourcePlugin, plugin_id)

    async def add(self, plugin: SourcePlugin) -> SourcePlugin:
        async with async_session() as session:
            session.add(plugin)
            await session.commit()
            await session.refresh(plugin)
            return plugin

    async def update(self, plugin_id: str, **fields) -> SourcePlugin | None:
        async with async_session() as session:
            plugin = await session.get(SourcePlugin, plugin_id)
            if plugin is None:
                return None
            for key, value in fields.items():
                setattr(plugin, key, value)
            await session.commit()
            await session.refresh(plugin)
            return plugin

    async def delete(self, plugin_id: str) -> bool:
        async with async_session() as session:
            plugin = await session.get(SourcePlugin, plugin_id)
            if plugin is None:
                return False
            await session.delete(plugin)
            await session.commit()
            return True
