from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.features.assessment.schema import AssessmentSubmitRequest
from app.features.assessment.service import assessment_service
from app.features.auth.dependencies import get_current_user
from app.utils.helpers import build_response

router = APIRouter(prefix="/assessment", tags=["assessment"])


@router.get("/onboarding")
def get_onboarding(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return build_response(
        "Assessment onboarding overview",
        assessment_service.get_overview(db, user=current_user),
    )


@router.post("/onboarding/skip")
def skip_onboarding(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return build_response(
        "Assessment skipped for now",
        assessment_service.skip_onboarding(db, user=current_user),
    )


@router.post("/onboarding/submit")
def submit_onboarding(
    payload: AssessmentSubmitRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = assessment_service.submit_onboarding(
        db,
        user=current_user,
        answers=payload.answers,
    )
    return build_response(
        "Assessment completed successfully",
        result.model_dump(mode="json"),
    )


@router.get("/result")
def get_result(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    result = assessment_service.get_result(db, user=current_user)
    return build_response(
        "Assessment result",
        result.model_dump(mode="json"),
    )
