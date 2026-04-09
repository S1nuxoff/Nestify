import argparse
import asyncio

from sqlalchemy import select

from app.db.session import async_session
from app.models.accounts import Account
from app.models.users import User
from app.services.auth import hash_password


async def backfill_legacy_profiles(email: str, password: str) -> None:
    normalized_email = email.strip().lower()

    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(Account).where(Account.email == normalized_email)
            )
            account = result.scalar_one_or_none()

            if account is None:
                account = Account(
                    email=normalized_email,
                    password_hash=hash_password(password),
                    is_active=True,
                )
                session.add(account)
                await session.flush()
            else:
                account.password_hash = hash_password(password)

            legacy_profiles_result = await session.execute(
                select(User)
                .where(User.account_id.is_(None))
                .order_by(User.created_at.asc(), User.id.asc())
            )
            legacy_profiles = legacy_profiles_result.scalars().all()

            for profile in legacy_profiles:
                profile.account_id = account.id

        await session.commit()

    print(
        f"Attached {len(legacy_profiles)} legacy profiles to account "
        f"{normalized_email} (account_id={account.id})."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    asyncio.run(backfill_legacy_profiles(args.email, args.password))


if __name__ == "__main__":
    main()
