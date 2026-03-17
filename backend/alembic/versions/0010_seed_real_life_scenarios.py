"""seed real-life scenario pack

Revision ID: 0010_seed_real_life_scenarios
Revises: 0009_conversation_correction
Create Date: 2026-03-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_seed_real_life_scenarios"
down_revision = "0009_conversation_correction"
branch_labels = None
depends_on = None


SCENARIOS = [
    (
        "Airport Check-in",
        "Practice an airport check-in conversation including baggage, documents, and seat requests.",
        "Beginner",
        "You are an airline check-in agent. Ask for passport details, confirm destination, and handle baggage questions politely.",
    ),
    (
        "Doctor Appointment",
        "Explain symptoms and get medical advice in a clear, calm conversation.",
        "Intermediate",
        "You are a doctor. Ask about symptoms, duration, and provide clear next steps.",
    ),
    (
        "Hotel Booking",
        "Handle a hotel reservation, room preferences, and check-in questions.",
        "Beginner",
        "You are a hotel receptionist. Confirm dates, room type, and answer guest questions.",
    ),
    (
        "Office Meeting",
        "Participate in a professional meeting with updates, blockers, and next steps.",
        "Intermediate",
        "You are a project lead. Ask for updates, clarify blockers, and summarize next steps.",
    ),
    (
        "Sales Call",
        "Present a product and respond to a prospect’s concerns.",
        "Advanced",
        "You are a sales representative. Ask discovery questions, present value, and address objections.",
    ),
    (
        "Visa Interview",
        "Answer questions about travel plans, purpose, and background.",
        "Advanced",
        "You are a visa officer. Ask clear, direct questions and evaluate the applicant's responses.",
    ),
    (
        "Storytelling",
        "Tell a short story with a clear beginning, middle, and end.",
        "Beginner",
        "You are a storytelling coach. Ask for a clear story and encourage details and sequencing.",
    ),
    (
        "Debate Practice",
        "Argue a position with reasons, examples, and rebuttals.",
        "Advanced",
        "You are a debate partner. Ask for a clear position, then challenge it respectfully.",
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    for title, description, difficulty, system_prompt in SCENARIOS:
        conn.execute(
            sa.text(
                """
                INSERT INTO scenarios (title, description, difficulty, system_prompt)
                VALUES (:title, :description, :difficulty, :system_prompt)
                ON CONFLICT (title) DO NOTHING
                """
            ),
            {
                "title": title,
                "description": description,
                "difficulty": difficulty,
                "system_prompt": system_prompt,
            },
        )


def downgrade() -> None:
    titles = tuple(title for title, _, _, _ in SCENARIOS)
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM scenarios
            WHERE title IN :titles
            """
        ).bindparams(sa.bindparam("titles", expanding=True)),
        {"titles": titles},
    )
