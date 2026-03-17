"""add message analyses cache

Revision ID: 0014_message_analyses
Revises: 0013_retention_goals
Create Date: 2026-03-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_message_analyses"
down_revision = "0013_retention_goals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "message_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("analysis_type", sa.String(length=50), nullable=False),
        sa.Column("analysis", sa.JSON(), nullable=False, server_default="{}"),
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
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", "analysis_type", name="uq_message_analyses_message_type"),
    )
    op.create_index(op.f("ix_message_analyses_user_id"), "message_analyses", ["user_id"], unique=False)
    op.create_index(op.f("ix_message_analyses_conversation_id"), "message_analyses", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_message_analyses_message_id"), "message_analyses", ["message_id"], unique=False)
    op.create_index(op.f("ix_message_analyses_analysis_type"), "message_analyses", ["analysis_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_message_analyses_analysis_type"), table_name="message_analyses")
    op.drop_index(op.f("ix_message_analyses_message_id"), table_name="message_analyses")
    op.drop_index(op.f("ix_message_analyses_conversation_id"), table_name="message_analyses")
    op.drop_index(op.f("ix_message_analyses_user_id"), table_name="message_analyses")
    op.drop_table("message_analyses")

