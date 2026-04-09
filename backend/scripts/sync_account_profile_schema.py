import asyncio

from sqlalchemy import text

from app.db.session import engine

TARGET_REVISION = "c63157a0f3e1"


STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id INTEGER",
    "CREATE INDEX IF NOT EXISTS ix_users_account_id ON users (account_id)",
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_account_id_accounts'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_account_id_accounts
        FOREIGN KEY (account_id) REFERENCES accounts (id);
      END IF;
    END$$
    """,
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_key",
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_users_account_name'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT uq_users_account_name UNIQUE (account_id, name);
      END IF;
    END$$
    """,
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS display_name VARCHAR(80)",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)",
]


async def main() -> None:
    async with engine.begin() as conn:
        for statement in STATEMENTS:
            await conn.execute(text(statement))

        version_exists = await conn.execute(
            text("SELECT COUNT(*) FROM alembic_version")
        )
        has_version_row = version_exists.scalar_one() > 0

        if has_version_row:
            await conn.execute(
                text("UPDATE alembic_version SET version_num = :revision"),
                {"revision": TARGET_REVISION},
            )
        else:
            await conn.execute(
                text(
                    "INSERT INTO alembic_version (version_num) VALUES (:revision)"
                ),
                {"revision": TARGET_REVISION},
            )

    await engine.dispose()
    print(f"Schema synced and alembic stamped to {TARGET_REVISION}.")


if __name__ == "__main__":
    asyncio.run(main())
