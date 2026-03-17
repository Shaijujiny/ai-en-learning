from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.credits.dependencies import require_credits
from app.features.messages.schema import MessageSendRequest
from app.features.messages.service import message_service
from app.utils.helpers import build_response

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_message(
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_credits),
):
    return build_response(
        "Message sent successfully",
        message_service.send_message(db, payload=payload, current_user=current_user),
        status_code=status.HTTP_201_CREATED,
    )
