from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.analytics_service import analytics_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.analytics.schemas import DashboardResponse
from app.utils.helpers import build_response

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) :
    data = analytics_service.build_dashboard(db=db, user_id=current_user.id)
    return build_response(
        "Dashboard loaded successfully",
        DashboardResponse(**data).model_dump(mode="json"),
    )
