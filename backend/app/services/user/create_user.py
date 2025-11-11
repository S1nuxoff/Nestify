from app.db.session import async_session
from app.models.users import User, UserRole
from datetime import datetime


async def create_user(
    name: str,
    avatar_url: str,
    pin_code: str = None,
    role: UserRole = UserRole.user,
):
    async with async_session() as session:
        async with session.begin():
            user = User(
                name=name.strip(),
                avatar_url=avatar_url,
                pin_code=pin_code,
                role=role,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
        await session.commit()
        return user
