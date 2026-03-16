"""add conversation language

Revision ID: 0005_conv_language
Revises: 0004_analytics_tables
Create Date: 2026-03-16 20:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_conv_language"
down_revision = "0004_analytics_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column(
            "language",
            sa.String(length=50),
            nullable=False,
            server_default=sa.text("'English'"),
        ),
    )
    op.create_check_constraint(
        "ck_conversations_language_allowed",
        "conversations",
        "language IN ('English', 'Spanish', 'French', 'German')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_conversations_language_allowed",
        "conversations",
        type_="check",
    )
    op.drop_column("conversations", "language")
