"""add_account_profile_fields

Revision ID: c63157a0f3e1
Revises: 0dfe385f8e3e
Create Date: 2026-04-06 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c63157a0f3e1"
down_revision: Union[str, Sequence[str], None] = "0dfe385f8e3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("display_name", sa.String(length=80), nullable=True))
    op.add_column("accounts", sa.Column("avatar_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "avatar_url")
    op.drop_column("accounts", "display_name")
