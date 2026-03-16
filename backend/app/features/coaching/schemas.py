from pydantic import BaseModel, Field


class CoachFeedbackRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class CoachFeedbackResponse(BaseModel):
    text: str
    grammar_match_count: int
    fluency_score: float
    vocabulary_score: float
    summary: str
    grammar_suggestions: list[str]
    interview_answer_suggestions: list[str]


class RecommendedScenarioResponse(BaseModel):
    scenario_id: int
    title: str
    difficulty: str
    reason: str


class SkillImprovementResponse(BaseModel):
    skill_name: str
    metric_value: float
    priority: str


class LearningPathResponse(BaseModel):
    current_level: str
    recent_average_score: float
    focus_areas: list[str]
    recommended_scenarios: list[RecommendedScenarioResponse]
    skill_improvements: list[SkillImprovementResponse]


class CareerAdvisorRequest(BaseModel):
    resume_text: str = Field(min_length=1, max_length=12000)
    target_role: str = Field(min_length=1, max_length=255)
    focus_area: str = Field(default="general interview preparation", max_length=255)


class CareerAdvisorResponse(BaseModel):
    summary: str
    resume_feedback: list[str]
    career_advice: list[str]
    mock_interview_preparation: list[str]
