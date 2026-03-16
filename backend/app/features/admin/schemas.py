from datetime import datetime

from pydantic import BaseModel

from app.database.models.conversation import ConversationLanguage
from app.database.models.scenario import ScenarioDifficulty


class AdminScenarioRequest(BaseModel):
    title: str
    description: str
    difficulty: ScenarioDifficulty
    system_prompt: str


class AdminScenarioResponse(BaseModel):
    id: int
    title: str
    description: str
    difficulty: ScenarioDifficulty
    system_prompt: str
    created_at: datetime
    updated_at: datetime


class AdminUsageResponse(BaseModel):
    total_users: int
    total_conversations: int
    total_messages: int
    total_scores: int
    language_usage: dict[str, int]


class AdminAnalyticsOverviewResponse(BaseModel):
    average_performance_score: float
    total_skill_metrics: int
    top_skill_metrics: list[dict[str, float | str]]
