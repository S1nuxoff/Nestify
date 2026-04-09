from app.db.session import async_session
from app.models.users import User, UserRole
from datetime import datetime
from sqlalchemy import select


async def create_user(
    name: str,
    avatar_url: str,
    pin_code: str = None,
    role: UserRole = UserRole.user,
    account_id: int | None = None,
):
    async with async_session() as session:
        async with session.begin():
            existing = await session.execute(
                select(User).where(
                    User.name == name.strip(),
                    User.account_id == account_id,
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError("Profile with this name already exists")

            user = User(
                name=name.strip(),
                account_id=account_id,
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
