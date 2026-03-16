"""add learning intelligence tables

Revision ID: 0008_learning_intelligence
Revises: 0007_onboarding_assessment
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_learning_intelligence"
down_revision = "0007_onboarding_assessment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_level_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_level_history_level"), "user_level_history", ["level"], unique=False)
    op.create_index(op.f("ix_user_level_history_source"), "user_level_history", ["source"], unique=False)
    op.create_index(op.f("ix_user_level_history_user_id"), "user_level_history", ["user_id"], unique=False)

    op.create_table(
        "personalized_lessons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("recommended_scenario_id", sa.Integer(), nullable=True),
        sa.Column("lesson_type", sa.String(length=50), nullable=False),
        sa.Column("target_skill", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="recommended"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["recommended_scenario_id"], ["scenarios.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_personalized_lessons_lesson_type"), "personalized_lessons", ["lesson_type"], unique=False)
    op.create_index(op.f("ix_personalized_lessons_status"), "personalized_lessons", ["status"], unique=False)
    op.create_index(op.f("ix_personalized_lessons_target_skill"), "personalized_lessons", ["target_skill"], unique=False)
    op.create_index(op.f("ix_personalized_lessons_user_id"), "personalized_lessons", ["user_id"], unique=False)

    op.create_table(
        "mistake_memory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("mistake_type", sa.String(length=100), nullable=False),
        sa.Column("mistake_key", sa.String(length=255), nullable=False),
        sa.Column("example_text", sa.Text(), nullable=False),
        sa.Column("correction", sa.Text(), nullable=True),
        sa.Column("hint", sa.Text(), nullable=True),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_mistake_memory_mistake_key"), "mistake_memory", ["mistake_key"], unique=False)
    op.create_index(op.f("ix_mistake_memory_mistake_type"), "mistake_memory", ["mistake_type"], unique=False)
    op.create_index(op.f("ix_mistake_memory_user_id"), "mistake_memory", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_mistake_memory_user_id"), table_name="mistake_memory")
    op.drop_index(op.f("ix_mistake_memory_mistake_type"), table_name="mistake_memory")
    op.drop_index(op.f("ix_mistake_memory_mistake_key"), table_name="mistake_memory")
    op.drop_table("mistake_memory")

    op.drop_index(op.f("ix_personalized_lessons_user_id"), table_name="personalized_lessons")
    op.drop_index(op.f("ix_personalized_lessons_target_skill"), table_name="personalized_lessons")
    op.drop_index(op.f("ix_personalized_lessons_status"), table_name="personalized_lessons")
    op.drop_index(op.f("ix_personalized_lessons_lesson_type"), table_name="personalized_lessons")
    op.drop_table("personalized_lessons")

    op.drop_index(op.f("ix_user_level_history_user_id"), table_name="user_level_history")
    op.drop_index(op.f("ix_user_level_history_source"), table_name="user_level_history")
    op.drop_index(op.f("ix_user_level_history_level"), table_name="user_level_history")
    op.drop_table("user_level_history")
