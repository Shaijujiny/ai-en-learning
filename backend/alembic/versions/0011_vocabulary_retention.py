"""add vocabulary retention tables

Revision ID: 0011_vocabulary_retention
Revises: 0010_seed_real_life_scenarios
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_vocabulary_retention"
down_revision = "0010_seed_real_life_scenarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vocabulary_words",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word", sa.String(length=100), nullable=False),
        sa.Column("example_text", sa.Text(), nullable=True),
        sa.Column("mastery_score", sa.Numeric(5, 2), nullable=False, server_default="20"),
        sa.Column("times_seen", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("times_correct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("times_incorrect", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vocabulary_words_user_id"), "vocabulary_words", ["user_id"], unique=False)
    op.create_index(op.f("ix_vocabulary_words_word"), "vocabulary_words", ["word"], unique=False)

    op.create_table(
        "vocabulary_review_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("session_type", sa.String(length=50), nullable=False, server_default="flashcards"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="in_progress"),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vocabulary_review_sessions_user_id"), "vocabulary_review_sessions", ["user_id"], unique=False)

    op.create_table(
        "vocabulary_review_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("word_id", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.String(length=255), nullable=False),
        sa.Column("user_answer", sa.Text(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["vocabulary_review_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["vocabulary_words.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vocabulary_review_items_session_id"), "vocabulary_review_items", ["session_id"], unique=False)
    op.create_index(op.f("ix_vocabulary_review_items_word_id"), "vocabulary_review_items", ["word_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_vocabulary_review_items_word_id"), table_name="vocabulary_review_items")
    op.drop_index(op.f("ix_vocabulary_review_items_session_id"), table_name="vocabulary_review_items")
    op.drop_table("vocabulary_review_items")

    op.drop_index(op.f("ix_vocabulary_review_sessions_user_id"), table_name="vocabulary_review_sessions")
    op.drop_table("vocabulary_review_sessions")

    op.drop_index(op.f("ix_vocabulary_words_word"), table_name="vocabulary_words")
    op.drop_index(op.f("ix_vocabulary_words_user_id"), table_name="vocabulary_words")
    op.drop_table("vocabulary_words")
