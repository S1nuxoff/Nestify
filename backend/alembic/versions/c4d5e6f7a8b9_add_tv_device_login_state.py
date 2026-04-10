"""add_tv_device_login_state

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5a6
Create Date: 2026-04-10 18:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tv_devices",
        sa.Column("is_logged_in", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "tv_devices",
        sa.Column("logged_out_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("tv_devices", "is_logged_in", server_default=None)


def downgrade() -> None:
    op.drop_column("tv_devices", "logged_out_at")
    op.drop_column("tv_devices", "is_logged_in")
