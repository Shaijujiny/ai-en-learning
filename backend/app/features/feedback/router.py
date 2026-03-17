from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.analytics_service import analytics_service
from app.core.feedback_service import feedback_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.feedback.schemas import (
    RubricRequest,
    RubricResponse,
    RewriteRequest,
    RewriteResponse,
)
from app.utils.helpers import build_response

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/rubric", status_code=status.HTTP_200_OK)
def score_rubric(
    payload: RubricRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        text, resolved_conversation_id = feedback_service.resolve_message_text(
            db=db,
            current_user=current_user,
            message_id=payload.message_id,
            text=payload.text,
        )
    except ValueError as exc:
        status_code = (
            status.HTTP_404_NOT_FOUND
            if str(exc).lower().startswith("message not found")
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=status_code,
            detail=str(exc),
        ) from exc

    question = payload.question
    conversation_id = payload.conversation_id or resolved_conversation_id
    if not question:
        question = feedback_service.resolve_last_prompt(
            db=db, current_user=current_user, conversation_id=conversation_id
        )

    result = feedback_service.score_rubric(text=text, question=question)

    # Persist scores so dashboard/timeline can reflect rubric and detect drops.
    score_types = {"overall": result.overall_score, **result.scores}
    for key, value in score_types.items():
        analytics_service.record_score(
            db=db,
            user_id=current_user.id,
            conversation_id=conversation_id,
            score_type=f"answer_quality_{key}",
            score_value=float(value),
            feedback=None,
        )
        analytics_service.upsert_skill_metric(
            db=db,
            user_id=current_user.id,
            skill_name=f"answer_quality_{key}",
            metric_value=float(value),
        )
    db.commit()

    response = RubricResponse(
        text=text,
        question=question,
        overall_score=result.overall_score,
        scores=result.scores,
        action_items=result.action_items,
        notes=result.notes,
    )
    return build_response("Answer rubric scored", response.model_dump(mode="json"))


@router.post("/rewrite", status_code=status.HTTP_200_OK)
def rewrite_answer(
    payload: RewriteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        text, _ = feedback_service.resolve_message_text(
            db=db,
            current_user=current_user,
            message_id=payload.message_id,
            text=payload.text,
        )
    except ValueError as exc:
        status_code = (
            status.HTTP_404_NOT_FOUND
            if str(exc).lower().startswith("message not found")
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=status_code,
            detail=str(exc),
        ) from exc

    data = feedback_service.rewrite(text=text, mode=payload.mode)
    response = RewriteResponse(**data)
    return build_response("Answer rewritten", response.model_dump(mode="json"))
