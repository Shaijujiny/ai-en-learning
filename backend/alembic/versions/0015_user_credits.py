"""add user_credits table

Revision ID: 0015_user_credits
Revises: 0014_message_analyses
Create Date: 2026-03-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0015_user_credits"
down_revision = "0014_message_analyses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_credits",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_credits", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("remaining_credits", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("idx_user_credits_user_id", "user_credits", ["user_id"], unique=True)

    # Also add the two indexes introduced in the backend model changes.
    op.create_index("idx_conversation_user_id", "conversations", ["user_id"])
    op.create_index("idx_message_conv_created", "messages", ["conversation_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_message_conv_created", table_name="messages")
    op.drop_index("idx_conversation_user_id", table_name="conversations")
    op.drop_index("idx_user_credits_user_id", table_name="user_credits")
    op.drop_table("user_credits")
