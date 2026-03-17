from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.daily.service import daily_service
from app.utils.helpers import build_response

router = APIRouter(prefix="/daily", tags=["daily"])


@router.get("/status", status_code=status.HTTP_200_OK)
def get_daily_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = daily_service.get_status(db, user_id=current_user.id)
    return build_response("Daily status", data)


@router.post("/complete/{task_id}", status_code=status.HTTP_200_OK)
def complete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = daily_service.complete_task(db, user_id=current_user.id, task_id=task_id)
    return build_response("Task completed", data)
