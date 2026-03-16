from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ConversationLanguage(str, Enum):
    ENGLISH = "English"
    SPANISH = "Spanish"
    FRENCH = "French"
    GERMAN = "German"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    scenario_id: Mapped[int] = mapped_column(
        ForeignKey("scenarios.id", ondelete="RESTRICT")
    )
    language: Mapped[ConversationLanguage] = mapped_column(
        String(50), default=ConversationLanguage.ENGLISH, server_default="English"
    )
    custom_title: Mapped[str | None] = mapped_column(String(255))
    custom_prompt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(50), default="active", server_default="active"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="conversations")
    scenario: Mapped["Scenario"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id",
    )
    user_scores: Mapped[list["UserScore"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
