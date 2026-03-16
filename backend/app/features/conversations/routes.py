from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.conversations.schema import ConversationStartRequest
from app.features.conversations.service import conversation_service
from app.utils.helpers import build_response

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_conversation(
    payload: ConversationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_response(
        "Conversation started successfully",
        conversation_service.start_conversation(db, payload=payload, current_user=current_user),
        status_code=status.HTTP_201_CREATED,
    )


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_response(
        "Conversation detail",
        conversation_service.get_conversation(
            db,
            conversation_id=conversation_id,
            current_user=current_user,
        ),
    )
