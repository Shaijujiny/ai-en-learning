from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class VocabularyReviewItem(Base):
    __tablename__ = "vocabulary_review_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("vocabulary_review_sessions.id", ondelete="CASCADE"), index=True
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("vocabulary_words.id", ondelete="CASCADE"), index=True
    )
    prompt: Mapped[str] = mapped_column(String(255))
    user_answer: Mapped[str | None] = mapped_column(Text)
    is_correct: Mapped[bool | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped["VocabularyReviewSession"] = relationship(back_populates="items")
    word: Mapped["VocabularyWord"] = relationship(back_populates="review_items")
