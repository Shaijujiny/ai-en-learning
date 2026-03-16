from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.database.models.conversation import ConversationLanguage
from app.features.messages.schemas import MessageRecordResponse


class ConversationStartRequest(BaseModel):
    scenario_id: int
    language: ConversationLanguage = ConversationLanguage.ENGLISH
    custom_title: str | None = None
    custom_prompt: str | None = None


class ConversationStartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    scenario_id: int
    language: ConversationLanguage
    custom_title: str | None
    custom_prompt: str | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    scenario_id: int
    language: ConversationLanguage
    custom_title: str | None
    custom_prompt: str | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageRecordResponse]
