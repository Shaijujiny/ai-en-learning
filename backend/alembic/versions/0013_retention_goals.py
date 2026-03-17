"""add retention goals

Revision ID: 0013_retention_goals
Revises: 0012_speaking_excellence
Create Date: 2026-03-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_retention_goals"
down_revision = "0012_speaking_excellence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("goals", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("users", "goals")

