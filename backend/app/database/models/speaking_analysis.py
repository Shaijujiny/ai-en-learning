from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class SpeakingAnalysis(Base):
    __tablename__ = "speaking_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), index=True
    )
    assessment_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_sessions.id", ondelete="SET NULL"), index=True
    )

    transcript: Mapped[str] = mapped_column(Text)

    pronunciation_score: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0, server_default="0"
    )
    confidence_score: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0, server_default="0"
    )
    analysis: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="speaking_analyses")
    conversation: Mapped["Conversation | None"] = relationship()
    assessment_session: Mapped["AssessmentSession | None"] = relationship()

