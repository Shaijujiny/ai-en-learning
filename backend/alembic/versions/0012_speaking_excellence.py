"""add speaking excellence analyses

Revision ID: 0012_speaking_excellence
Revises: 0011_vocabulary_retention
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_speaking_excellence"
down_revision = "0011_vocabulary_retention"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "speaking_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=True),
        sa.Column("assessment_session_id", sa.Integer(), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column(
            "pronunciation_score", sa.Numeric(5, 2), nullable=False, server_default="0"
        ),
        sa.Column(
            "confidence_score", sa.Numeric(5, 2), nullable=False, server_default="0"
        ),
        sa.Column("analysis", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["assessment_session_id"], ["assessment_sessions.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_speaking_analyses_assessment_session_id"),
        "speaking_analyses",
        ["assessment_session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_speaking_analyses_conversation_id"),
        "speaking_analyses",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_speaking_analyses_user_id"),
        "speaking_analyses",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_speaking_analyses_user_id"), table_name="speaking_analyses")
    op.drop_index(
        op.f("ix_speaking_analyses_conversation_id"), table_name="speaking_analyses"
    )
    op.drop_index(
        op.f("ix_speaking_analyses_assessment_session_id"),
        table_name="speaking_analyses",
    )
    op.drop_table("speaking_analyses")

