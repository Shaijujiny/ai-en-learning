from datetime import date as date_type
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class UserDailyProgress(Base):
    __tablename__ = "user_daily_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "plan_date", name="uq_user_daily_progress"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    plan_date: Mapped[date_type] = mapped_column(Date, nullable=False)

    # Task completions
    conversation_done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    vocabulary_done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    speaking_done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    review_done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    xp_earned: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="daily_progress")
