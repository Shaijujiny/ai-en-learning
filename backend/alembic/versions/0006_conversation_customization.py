"""add custom conversation fields

Revision ID: 0006_conversation_customization
Revises: 0005_conv_language
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0006_conversation_customization"
down_revision = "0005_conv_language"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("custom_title", sa.String(length=255), nullable=True))
    op.add_column("conversations", sa.Column("custom_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conversations", "custom_prompt")
    op.drop_column("conversations", "custom_title")
