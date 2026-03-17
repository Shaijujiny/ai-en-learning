from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    assessment_status: Mapped[str] = mapped_column(
        String(50), default="pending", server_default="pending"
    )
    user_level: Mapped[str | None] = mapped_column(String(20), index=True)
    skill_breakdown: Mapped[dict | None] = mapped_column(JSON)
    recommended_path: Mapped[list[dict] | None] = mapped_column(JSON)
    goals: Mapped[dict | None] = mapped_column(JSON, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    user_scores: Mapped[list["UserScore"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    skill_metrics: Mapped[list["SkillMetric"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    assessment_sessions: Mapped[list["AssessmentSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    level_history: Mapped[list["UserLevelHistory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    personalized_lessons: Mapped[list["PersonalizedLesson"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    mistake_memories: Mapped[list["MistakeMemory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    vocabulary_words: Mapped[list["VocabularyWord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    vocabulary_review_sessions: Mapped[list["VocabularyReviewSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    speaking_analyses: Mapped[list["SpeakingAnalysis"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    credits: Mapped["UserCredit | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    xp: Mapped["UserXP | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    daily_progress: Mapped[list["UserDailyProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
