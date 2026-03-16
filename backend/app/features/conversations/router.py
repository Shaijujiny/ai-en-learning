from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.scenario import Scenario
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.conversations.schemas import (
    ConversationDetailResponse,
    ConversationStartRequest,
    ConversationStartResponse,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("/start", response_model=ConversationStartResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    payload: ConversationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Conversation:
    scenario = db.query(Scenario).filter(Scenario.id == payload.scenario_id).first()
    if scenario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )

    conversation = Conversation(
        user_id=current_user.id,
        scenario_id=scenario.id,
        language=payload.language,
        custom_title=payload.custom_title,
        custom_prompt=payload.custom_prompt,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return conversation
