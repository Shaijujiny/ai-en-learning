from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.career_advisor_service import career_advisor_service
from app.core.coach_service import coach_service
from app.core.fluency_service import fluency_service
from app.core.grammar_service import grammar_service
from app.core.vocabulary_service import vocabulary_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.coaching.schemas import (
    CareerAdvisorRequest,
    CareerAdvisorResponse,
    CoachFeedbackRequest,
    CoachFeedbackResponse,
    LearningPathResponse,
)
from app.utils.helpers import build_response

router = APIRouter(prefix="/coaching", tags=["coaching"])


@router.post("/feedback")
def generate_feedback(
    payload: CoachFeedbackRequest,
    current_user: User = Depends(get_current_user),
):
    grammar_result = grammar_service.safe_analyze_text(payload.text)
    grammar_match_count = len(grammar_result.get("matches", [])) if grammar_result else 0
    fluency_result = fluency_service.analyze(
        text=payload.text,
        grammar_match_count=grammar_match_count,
    )
    vocabulary_result = vocabulary_service.analyze(payload.text)

    feedback = coach_service.generate_feedback(
        text=payload.text,
        grammar_match_count=grammar_match_count,
        fluency_score=fluency_result["overall_score"],
        vocabulary_score=vocabulary_result["overall_score"],
    )
    response = CoachFeedbackResponse(
        text=payload.text,
        grammar_match_count=grammar_match_count,
        fluency_score=fluency_result["overall_score"],
        vocabulary_score=vocabulary_result["overall_score"],
        **feedback,
    )
    return build_response("Coaching feedback generated", response.model_dump(mode="json"))


@router.get("/learning-path")
def get_learning_path(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = coach_service.build_learning_path(db=db, user_id=current_user.id)
    return build_response(
        "Learning path generated",
        LearningPathResponse(**data).model_dump(mode="json"),
    )


@router.post("/career-advisor")
def generate_career_advice(
    payload: CareerAdvisorRequest,
    _: User = Depends(get_current_user),
):
    advice = career_advisor_service.generate_advice(
        resume_text=payload.resume_text,
        target_role=payload.target_role,
        focus_area=payload.focus_area,
    )
    return build_response(
        "Career advice generated",
        CareerAdvisorResponse(**advice).model_dump(mode="json"),
    )
