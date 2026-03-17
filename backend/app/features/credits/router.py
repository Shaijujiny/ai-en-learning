from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.credit_service import credit_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_admin, get_current_user
from app.utils.helpers import build_response

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("", status_code=status.HTTP_200_OK)
def get_credits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_response(
        "Credits retrieved",
        credit_service.get_credits(db, user_id=current_user.id),
    )


@router.post("/add", status_code=status.HTTP_200_OK)
def add_credits(
    amount: int = 20,
    user_id: int | None = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    target_id = user_id or current_admin.id
    credit = credit_service.add_credits(db, user_id=target_id, amount=amount)
    db.commit()
    return build_response(
        "Credits added",
        {"user_id": target_id, "remaining": credit.remaining_credits, "total": credit.total_credits},
    )
