from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.personalization_service import personalization_service
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.utils.helpers import build_response

router = APIRouter(prefix="/personalization", tags=["personalization"])


@router.get("/recommendations", status_code=status.HTTP_200_OK)
def get_recommendations(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = personalization_service.get_recommendations(db, user=current_user, limit=limit)
    return build_response("Personalized recommendations", data)
