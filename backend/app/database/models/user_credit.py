from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

_DEFAULT_CREDITS = 20


class UserCredit(Base):
    __tablename__ = "user_credits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    total_credits: Mapped[int] = mapped_column(
        Integer, default=_DEFAULT_CREDITS, server_default=str(_DEFAULT_CREDITS)
    )
    remaining_credits: Mapped[int] = mapped_column(
        Integer, default=_DEFAULT_CREDITS, server_default=str(_DEFAULT_CREDITS)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="credits")
