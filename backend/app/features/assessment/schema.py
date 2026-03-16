from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AssessmentQuestion(BaseModel):
    key: str
    order: int
    category: str
    title: str
    prompt: str
    placeholder: str
    answer_type: str = "text"
    min_length: int = 20


class AssessmentAnswerInput(BaseModel):
    question_key: str
    answer_text: str = Field(min_length=1, max_length=4000)
    answer_type: str = Field(default="text", max_length=50)


class AssessmentSubmitRequest(BaseModel):
    answers: list[AssessmentAnswerInput] = Field(min_length=5, max_length=7)


class PracticeRecommendation(BaseModel):
    day: int
    focus: str
    action: str
    target_skill: str


class AssessmentResultData(BaseModel):
    session_id: int | None = None
    status: str
    current_level: str | None = None
    strongest_skill: str | None = None
    weakest_skill: str | None = None
    recommended_first_scenario: str | None = None
    recommended_first_scenario_id: int | None = None
    seven_day_practice_suggestion: list[PracticeRecommendation] = Field(default_factory=list)
    skill_breakdown: dict[str, float] = Field(default_factory=dict)
    score_summary: dict[str, float | str] = Field(default_factory=dict)
    completion_notes: str | None = None
    completed_at: datetime | None = None


class AssessmentOverview(BaseModel):
    status: str
    current_level: str | None = None
    questions: list[AssessmentQuestion] = Field(default_factory=list)
    latest_result: AssessmentResultData | None = None


class LearningProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assessment_status: str
    user_level: str | None = None
    skill_breakdown: dict | None = None
    recommended_path: list[dict] | None = None

