from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class VocabularyWord(Base):
    __tablename__ = "vocabulary_words"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    word: Mapped[str] = mapped_column(String(100), index=True)
    example_text: Mapped[str | None] = mapped_column(Text)
    mastery_score: Mapped[float] = mapped_column(Numeric(5, 2), default=20, server_default="20")
    times_seen: Mapped[int] = mapped_column(default=1, server_default="1")
    times_correct: Mapped[int] = mapped_column(default=0, server_default="0")
    times_incorrect: Mapped[int] = mapped_column(default=0, server_default="0")
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="vocabulary_words")
    review_items: Mapped[list["VocabularyReviewItem"]] = relationship(
        back_populates="word", cascade="all, delete-orphan"
    )
