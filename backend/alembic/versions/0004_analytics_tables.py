"""create analytics tables

Revision ID: 0004_analytics_tables
Revises: 0003_scenario_difficulty
Create Date: 2026-03-16 20:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_analytics_tables"
down_revision = "0003_scenario_difficulty"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=True),
        sa.Column("score_type", sa.String(length=100), nullable=False),
        sa.Column("score_value", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_user_scores_score_type"),
        "user_scores",
        ["score_type"],
        unique=False,
    )

    op.create_table(
        "skill_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("skill_name", sa.String(length=100), nullable=False),
        sa.Column("metric_value", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column(
            "sample_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_skill_metrics_skill_name"),
        "skill_metrics",
        ["skill_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_skill_metrics_skill_name"), table_name="skill_metrics")
    op.drop_table("skill_metrics")
    op.drop_index(op.f("ix_user_scores_score_type"), table_name="user_scores")
    op.drop_table("user_scores")
