from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.analytics_service import analytics_service
from app.core.retention_service import retention_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.analytics.schemas import DashboardResponse
from app.utils.helpers import build_response

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/combined")
def get_combined_dashboard(
    days: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    scenario_id: int | None = None,
    language: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analytics_data = analytics_service.build_dashboard(
        db=db,
        user_id=current_user.id,
        days=days,
        date_from=date_from,
        date_to=date_to,
        scenario_id=scenario_id,
        language=language,
    )
    retention_data = retention_service.build_summary(db=db, user=current_user)
    return build_response(
        "Combined dashboard loaded",
        {
            "analytics": DashboardResponse(**analytics_data).model_dump(mode="json"),
            "retention": retention_data,
        },
    )


@router.get("/dashboard")
def get_dashboard(
    days: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    scenario_id: int | None = None,
    language: str | None = None,
    score_type: str | None = None,
    level: str | None = None,
    mistake_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) :
    data = analytics_service.build_dashboard(
        db=db,
        user_id=current_user.id,
        days=days,
        date_from=date_from,
        date_to=date_to,
        scenario_id=scenario_id,
        language=language,
        score_type=score_type,
        level=level,
        mistake_type=mistake_type,
    )
    return build_response(
        "Dashboard loaded successfully",
        DashboardResponse(**data).model_dump(mode="json"),
    )
