"""credit daily reset columns

Revision ID: 0017_credit_daily_reset
Revises: 0016_daily_system
Create Date: 2026-03-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0017_credit_daily_reset"
down_revision = "0016_daily_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_credits",
        sa.Column("messages_today", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "user_credits",
        sa.Column("last_reset_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_credits", "last_reset_date")
    op.drop_column("user_credits", "messages_today")
