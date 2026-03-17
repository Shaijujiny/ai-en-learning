"""add daily system tables (user_xp, user_daily_progress)

Revision ID: 0016_daily_system
Revises: 0015_user_credits
Create Date: 2026-03-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0016_daily_system"
down_revision = "0015_user_credits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # user_xp: one row per user, persists total XP and streak
    op.create_table(
        "user_xp",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("total_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_active_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("idx_user_xp_user_id", "user_xp", ["user_id"], unique=True)

    # user_daily_progress: one row per user per day
    op.create_table(
        "user_daily_progress",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column(
            "conversation_done",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "vocabulary_done",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "speaking_done",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "review_done",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("xp_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "plan_date", name="uq_user_daily_progress"),
    )
    op.create_index(
        "idx_user_daily_progress_user_date",
        "user_daily_progress",
        ["user_id", "plan_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_user_daily_progress_user_date", table_name="user_daily_progress")
    op.drop_table("user_daily_progress")
    op.drop_index("idx_user_xp_user_id", table_name="user_xp")
    op.drop_table("user_xp")
