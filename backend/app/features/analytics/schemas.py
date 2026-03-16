from datetime import datetime

from pydantic import BaseModel


class SkillMetricResponse(BaseModel):
    skill_name: str
    metric_value: float
    sample_count: int
    updated_at: datetime


class TrendPointResponse(BaseModel):
    label: str
    value: float


class ImprovementTrendResponse(BaseModel):
    score_type: str
    points: list[TrendPointResponse]


class ConversationHistoryItemResponse(BaseModel):
    conversation_id: int
    scenario_title: str
    status: str
    message_count: int
    started_at: datetime
    latest_message: str | None


class DashboardResponse(BaseModel):
    performance_score: float
    skill_metrics: list[SkillMetricResponse]
    improvement_trends: list[ImprovementTrendResponse]
    conversation_history: list[ConversationHistoryItemResponse]
