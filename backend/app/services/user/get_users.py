from app.db.session import async_session
from app.models.users import User
from sqlalchemy import select


async def get_all_users():
    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        return users
