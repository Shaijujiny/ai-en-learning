from datetime import datetime

from pydantic import BaseModel


class SkillMetricResponse(BaseModel):
    skill_name: str
    metric_value: float
    sample_count: int
    updated_at: datetime


class LevelHistoryItemResponse(BaseModel):
    level: str
    confidence_score: float
    source: str
    created_at: datetime


class PersonalizedLessonResponse(BaseModel):
    id: int
    lesson_type: str
    target_skill: str
    title: str
    instructions: str
    status: str
    recommended_scenario: str | None
    created_at: datetime


class MistakeMemoryResponse(BaseModel):
    mistake_type: str
    mistake_key: str
    hint: str | None
    correction: str | None
    occurrence_count: int
    last_seen_at: datetime


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
    current_level: str | None
    level_confidence_score: float
    level_history: list[LevelHistoryItemResponse]
    skill_metrics: list[SkillMetricResponse]
    improvement_trends: list[ImprovementTrendResponse]
    personalized_lessons: list[PersonalizedLessonResponse]
    mistake_memory: list[MistakeMemoryResponse]
    conversation_history: list[ConversationHistoryItemResponse]
