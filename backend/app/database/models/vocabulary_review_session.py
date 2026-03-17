from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class VocabularyReviewSession(Base):
    __tablename__ = "vocabulary_review_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_type: Mapped[str] = mapped_column(String(50), default="flashcards", server_default="flashcards")
    status: Mapped[str] = mapped_column(String(50), default="in_progress", server_default="in_progress")
    total_items: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    correct_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="vocabulary_review_sessions")
    items: Mapped[list["VocabularyReviewItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
