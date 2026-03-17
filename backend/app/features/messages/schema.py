from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageSendRequest(BaseModel):
    conversation_id: int
    content: str = Field(min_length=1, max_length=4000)
    coach_mode: str | None = None  # "friendly" | "strict" | "casual"


class MessageRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_role: str
    content: str
    created_at: datetime


class MessageSendResponse(BaseModel):
    conversation_id: int
    user_message: MessageRecordResponse
    ai_message: MessageRecordResponse
