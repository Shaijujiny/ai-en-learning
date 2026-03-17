from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.report_service import report_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.utils.helpers import build_response

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/weekly", status_code=status.HTTP_200_OK)
def get_weekly_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = report_service.build_weekly_report(db=db, user_id=current_user.id)
    return build_response("Weekly progress report", data)


@router.get("/timeline", status_code=status.HTTP_200_OK)
def get_timeline(
    days: int = 14,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = report_service.build_timeline(db=db, user_id=current_user.id, days=days)
    return build_response("Coach timeline", data)
