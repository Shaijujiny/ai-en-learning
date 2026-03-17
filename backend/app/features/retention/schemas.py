from pydantic import BaseModel, Field


class RetentionSummaryResponse(BaseModel):
    today: str
    daily_streak: int
    active_today: bool
    weekly_range_start: str
    weekly_range_end: str
    goals: dict
    progress: dict


class RetentionGoalsUpdateRequest(BaseModel):
    weekly_lesson_target: int | None = Field(default=None, ge=1, le=14)
    weekly_vocabulary_items: int | None = Field(default=None, ge=1, le=200)
    weekly_fluency_target: float | None = Field(default=None, ge=0, le=100)
    weekly_interview_readiness_target: float | None = Field(default=None, ge=0, le=100)

