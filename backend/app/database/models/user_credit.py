from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

DAILY_CREDITS = 20
MESSAGES_PER_CREDIT = 5


class UserCredit(Base):
    __tablename__ = "user_credits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    total_credits: Mapped[int] = mapped_column(
        Integer, default=DAILY_CREDITS, server_default=str(DAILY_CREDITS)
    )
    remaining_credits: Mapped[int] = mapped_column(
        Integer, default=DAILY_CREDITS, server_default=str(DAILY_CREDITS)
    )
    # Counts messages sent today; resets to 0 with daily refresh
    messages_today: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    # The date credits were last reset; null = never reset yet
    last_reset_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="credits")
