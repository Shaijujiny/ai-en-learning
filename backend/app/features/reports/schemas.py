from pydantic import BaseModel


class WeeklySkillSummary(BaseModel):
    skill_name: str | None
    metric_value: float


class WeeklyMistakeItem(BaseModel):
    mistake_type: str
    mistake_key: str
    hint: str | None
    correction: str | None
    occurrence_count: int
    last_seen_at: str | None


class TrendPoint(BaseModel):
    label: str
    value: float


class WeeklyTrend(BaseModel):
    score_type: str
    points: list[TrendPoint]


class WeeklyReportResponse(BaseModel):
    range_start: str
    range_end: str
    strongest_skill: WeeklySkillSummary
    weakest_skill: WeeklySkillSummary
    repeated_mistakes: list[dict]
    weekly_trend: list[WeeklyTrend]
    next_week_goals: list[str]

