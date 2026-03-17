"""add correction mode to conversations

Revision ID: 0009_conversation_correction
Revises: 0008_learning_intelligence
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_conversation_correction"
down_revision = "0008_learning_intelligence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("correction_mode", sa.String(length=50), nullable=False, server_default="delayed"),
    )


def downgrade() -> None:
    op.drop_column("conversations", "correction_mode")
