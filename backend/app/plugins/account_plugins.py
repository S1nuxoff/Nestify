from sqlalchemy import select

from app.db.session import async_session
from app.models.account_plugin import AccountPlugin
from app.models.users import User, UserRole


class AccountPluginStore:
    async def removed(self, account_id: int) -> set[str]:
        async with async_session() as session:
            rows = await session.execute(
                select(AccountPlugin.plugin_id).where(
                    AccountPlugin.account_id == account_id,
                    AccountPlugin.installed.is_(False),
                )
            )
            return set(rows.scalars().all())

    async def set_installed(self, account_id: int, plugin_id: str, installed: bool) -> None:
        async with async_session() as session:
            row = await session.get(AccountPlugin, (account_id, plugin_id))
            if row:
                row.installed = installed
            else:
                session.add(AccountPlugin(account_id=account_id, plugin_id=plugin_id, installed=installed))
            await session.commit()

    async def is_admin(self, account_id: int) -> bool:
        async with async_session() as session:
            rows = await session.execute(
                select(User.id).where(User.account_id == account_id, User.role == UserRole.admin).limit(1)
            )
            return rows.first() is not None
