from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.retention_service import retention_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.retention.schemas import RetentionGoalsUpdateRequest
from app.utils.helpers import build_response

router = APIRouter(prefix="/retention", tags=["retention"])


@router.get("/summary", status_code=status.HTTP_200_OK)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = retention_service.build_summary(db=db, user=current_user)
    return build_response("Retention summary", data)


@router.put("/goals", status_code=status.HTTP_200_OK)
def update_goals(
    payload: RetentionGoalsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = retention_service.update_goals(
        db=db, user=current_user, goals=payload.model_dump(exclude_none=True)
    )
    return build_response("Goals updated", data)

