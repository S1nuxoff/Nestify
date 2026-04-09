"""add torrent fields to watch history

Revision ID: f3a1b2c4d5e6
Revises: ea7bdfade436
Create Date: 2026-04-07 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a1b2c4d5e6'
down_revision = 'c63157a0f3e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('watch_history', sa.Column('torrent_hash',    sa.String(), nullable=True))
    op.add_column('watch_history', sa.Column('torrent_file_id', sa.Integer(), nullable=True))
    op.add_column('watch_history', sa.Column('torrent_fname',   sa.String(), nullable=True))
    op.add_column('watch_history', sa.Column('torrent_magnet',  sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('watch_history', 'torrent_magnet')
    op.drop_column('watch_history', 'torrent_fname')
    op.drop_column('watch_history', 'torrent_file_id')
    op.drop_column('watch_history', 'torrent_hash')
