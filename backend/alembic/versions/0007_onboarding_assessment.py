"""add onboarding assessment and learning profile

Revision ID: 0007_onboarding_assessment
Revises: 0006_conversation_customization
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0007_onboarding_assessment"
down_revision = "0006_conversation_customization"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("assessment_status", sa.String(length=50), nullable=False, server_default="pending"),
    )
    op.add_column("users", sa.Column("user_level", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("skill_breakdown", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("recommended_path", sa.JSON(), nullable=True))
    op.create_index(op.f("ix_users_user_level"), "users", ["user_level"], unique=False)

    op.create_table(
        "assessment_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="in_progress"),
        sa.Column("session_type", sa.String(length=50), nullable=False, server_default="onboarding"),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("user_level", sa.String(length=20), nullable=True),
        sa.Column("strongest_skill", sa.String(length=100), nullable=True),
        sa.Column("weakest_skill", sa.String(length=100), nullable=True),
        sa.Column("recommended_scenario_id", sa.Integer(), nullable=True),
        sa.Column("score_summary", sa.JSON(), nullable=True),
        sa.Column("skill_breakdown", sa.JSON(), nullable=True),
        sa.Column("recommended_path", sa.JSON(), nullable=True),
        sa.Column("completion_notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("skipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["recommended_scenario_id"], ["scenarios.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_sessions_status"),
        "assessment_sessions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assessment_sessions_user_id"),
        "assessment_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assessment_sessions_user_level"),
        "assessment_sessions",
        ["user_level"],
        unique=False,
    )

    op.create_table(
        "assessment_answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_key", sa.String(length=100), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("question_category", sa.String(length=100), nullable=False),
        sa.Column("question_order", sa.Integer(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("answer_type", sa.String(length=50), nullable=False, server_default="text"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["assessment_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_answers_question_category"),
        "assessment_answers",
        ["question_category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assessment_answers_question_key"),
        "assessment_answers",
        ["question_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assessment_answers_session_id"),
        "assessment_answers",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assessment_answers_user_id"),
        "assessment_answers",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_assessment_answers_user_id"), table_name="assessment_answers")
    op.drop_index(op.f("ix_assessment_answers_session_id"), table_name="assessment_answers")
    op.drop_index(op.f("ix_assessment_answers_question_key"), table_name="assessment_answers")
    op.drop_index(op.f("ix_assessment_answers_question_category"), table_name="assessment_answers")
    op.drop_table("assessment_answers")

    op.drop_index(op.f("ix_assessment_sessions_user_level"), table_name="assessment_sessions")
    op.drop_index(op.f("ix_assessment_sessions_user_id"), table_name="assessment_sessions")
    op.drop_index(op.f("ix_assessment_sessions_status"), table_name="assessment_sessions")
    op.drop_table("assessment_sessions")

    op.drop_index(op.f("ix_users_user_level"), table_name="users")
    op.drop_column("users", "recommended_path")
    op.drop_column("users", "skill_breakdown")
    op.drop_column("users", "user_level")
    op.drop_column("users", "assessment_status")
