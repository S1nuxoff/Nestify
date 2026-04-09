"""add_accounts_and_profile_ownership

Revision ID: 0dfe385f8e3e
Revises: a6864beeba7f
Create Date: 2026-04-06 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0dfe385f8e3e"
down_revision: Union[str, Sequence[str], None] = "a6864beeba7f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.add_column("users", sa.Column("account_id", sa.Integer(), nullable=True))
    op.create_index("ix_users_account_id", "users", ["account_id"], unique=False)
    op.create_foreign_key(
        "fk_users_account_id_accounts",
        "users",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint("users_name_key", "users", type_="unique")
    op.create_unique_constraint("uq_users_account_name", "users", ["account_id", "name"])


def downgrade() -> None:
    op.drop_constraint("uq_users_account_name", "users", type_="unique")
    op.create_unique_constraint("users_name_key", "users", ["name"])
    op.drop_constraint("fk_users_account_id_accounts", "users", type_="foreignkey")
    op.drop_index("ix_users_account_id", table_name="users")
    op.drop_column("users", "account_id")
    op.drop_table("accounts")
