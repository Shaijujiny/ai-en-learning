from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.database.models.conversation import ConversationLanguage
from app.features.messages.schema import MessageRecordResponse


class ConversationStartRequest(BaseModel):
    scenario_id: int
    language: ConversationLanguage = ConversationLanguage.ENGLISH
    custom_title: str | None = Field(default=None, max_length=255)
    custom_prompt: str | None = Field(default=None, max_length=5000)
    correction_mode: str | None = "delayed"


class ConversationStartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    scenario_id: int
    language: ConversationLanguage
    custom_title: str | None
    custom_prompt: str | None
    correction_mode: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConversationSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scenario_id: int
    language: ConversationLanguage
    custom_title: str | None
    correction_mode: str
    status: str
    started_at: datetime
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    scenario_id: int
    language: ConversationLanguage
    custom_title: str | None
    custom_prompt: str | None
    correction_mode: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageRecordResponse]
