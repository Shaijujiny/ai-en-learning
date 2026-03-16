"""normalize scenario difficulty

Revision ID: 0003_scenario_difficulty
Revises: 0002_seed_default_scenarios
Create Date: 2026-03-16 20:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_scenario_difficulty"
down_revision = "0002_seed_default_scenarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE scenarios
            SET difficulty = CASE
                WHEN difficulty = 'easy' THEN 'Beginner'
                WHEN difficulty = 'medium' THEN 'Intermediate'
                WHEN difficulty = 'hard' THEN 'Advanced'
                WHEN difficulty IN ('Beginner', 'Intermediate', 'Advanced') THEN difficulty
                ELSE 'Intermediate'
            END
            """
        )
    )
    op.create_check_constraint(
        "ck_scenarios_difficulty_allowed",
        "scenarios",
        "difficulty IN ('Beginner', 'Intermediate', 'Advanced')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_scenarios_difficulty_allowed", "scenarios", type_="check")
    op.execute(
        sa.text(
            """
            UPDATE scenarios
            SET difficulty = CASE
                WHEN difficulty = 'Beginner' THEN 'easy'
                WHEN difficulty = 'Intermediate' THEN 'medium'
                WHEN difficulty = 'Advanced' THEN 'hard'
                ELSE 'medium'
            END
            """
        )
    )
