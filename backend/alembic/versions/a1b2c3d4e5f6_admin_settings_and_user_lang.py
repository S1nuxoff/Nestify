"""admin settings table and user default_lang

Revision ID: a1b2c3d4e5f6
Revises: f3a1b2c4d5e6
Create Date: 2026-04-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f3a1b2c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # app_settings may already exist if create_all_tables() ran on startup
    op.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(64) NOT NULL PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            description TEXT
        )
    """)
    # Add default_lang only if it doesn't exist yet
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS default_lang VARCHAR(10) NOT NULL DEFAULT 'best'
    """)


def downgrade() -> None:
    op.drop_column('users', 'default_lang')
    op.drop_table('app_settings')
