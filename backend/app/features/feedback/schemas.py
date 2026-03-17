from pydantic import BaseModel, Field


class RubricRequest(BaseModel):
    text: str | None = Field(default=None, max_length=8000)
    message_id: int | None = Field(default=None, ge=1)
    conversation_id: int | None = Field(default=None, ge=1)
    question: str | None = Field(default=None, max_length=4000)


class RubricResponse(BaseModel):
    text: str
    question: str | None
    overall_score: float
    scores: dict[str, float]
    action_items: list[str]
    notes: dict[str, str]


class RewriteRequest(BaseModel):
    text: str | None = Field(default=None, max_length=8000)
    message_id: int | None = Field(default=None, ge=1)
    mode: str = Field(
        default="make natural",
        max_length=40,
        description="One of: make natural, make professional, make advanced, make shorter, make interview-ready.",
    )


class RewriteResponse(BaseModel):
    mode: str
    rewritten_text: str
    notes: list[str]

