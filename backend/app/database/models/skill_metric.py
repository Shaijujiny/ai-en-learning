from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class SkillMetric(Base):
    __tablename__ = "skill_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    skill_name: Mapped[str] = mapped_column(String(100), index=True)
    metric_value: Mapped[float] = mapped_column(Numeric(5, 2))
    sample_count: Mapped[int] = mapped_column(default=1, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="skill_metrics")

