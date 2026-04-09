from sqlalchemy import select

from app.db.session import async_session
from app.models.users import User


async def get_all_users(account_id: int | None = None):
    async with async_session() as session:
        query = select(User)
        if account_id is not None:
            query = query.where(User.account_id == account_id)
        result = await session.execute(query.order_by(User.created_at.asc()))
        users = result.scalars().all()
        return users
