"""seed default scenarios

Revision ID: 0002_seed_default_scenarios
Revises: 0001_create_core_tables
Create Date: 2026-03-16 19:45:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_seed_default_scenarios"
down_revision = "0001_create_core_tables"
branch_labels = None
depends_on = None


scenarios_table = sa.table(
    "scenarios",
    sa.column("title", sa.String(length=255)),
    sa.column("description", sa.Text()),
    sa.column("difficulty", sa.String(length=50)),
    sa.column("system_prompt", sa.Text()),
)


def upgrade() -> None:
    op.bulk_insert(
        scenarios_table,
        [
            {
                "title": "Job Interview",
                "description": "Practice a realistic interview for a professional role with focused follow-up questions.",
                "difficulty": "Advanced",
                "system_prompt": "You are an interviewer running a structured job interview. Ask concise, relevant questions and adapt to the candidate's answers.",
            },
            {
                "title": "Customer Support",
                "description": "Handle a support conversation with a customer who needs a clear and empathetic resolution.",
                "difficulty": "Intermediate",
                "system_prompt": "You are a customer support representative. Be calm, helpful, and solution-oriented while gathering the right details.",
            },
            {
                "title": "Casual Conversation",
                "description": "Hold a natural, low-pressure conversation for everyday English practice.",
                "difficulty": "Beginner",
                "system_prompt": "You are a friendly conversation partner. Keep the exchange natural, engaging, and easy to continue.",
            },
        ],
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM scenarios
            WHERE title IN ('Job Interview', 'Customer Support', 'Casual Conversation')
            """
        )
    )
