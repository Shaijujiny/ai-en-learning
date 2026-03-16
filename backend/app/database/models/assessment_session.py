from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(
        String(50), default="in_progress", server_default="in_progress", index=True
    )
    session_type: Mapped[str] = mapped_column(
        String(50), default="onboarding", server_default="onboarding"
    )
    question_count: Mapped[int] = mapped_column(default=0, server_default="0")
    user_level: Mapped[str | None] = mapped_column(String(20), index=True)
    strongest_skill: Mapped[str | None] = mapped_column(String(100))
    weakest_skill: Mapped[str | None] = mapped_column(String(100))
    recommended_scenario_id: Mapped[int | None] = mapped_column(
        ForeignKey("scenarios.id", ondelete="SET NULL")
    )
    score_summary: Mapped[dict | None] = mapped_column(JSON)
    skill_breakdown: Mapped[dict | None] = mapped_column(JSON)
    recommended_path: Mapped[list[dict] | None] = mapped_column(JSON)
    completion_notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    skipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="assessment_sessions")
    answers: Mapped[list["AssessmentAnswer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="AssessmentAnswer.id"
    )
    recommended_scenario: Mapped["Scenario | None"] = relationship()

