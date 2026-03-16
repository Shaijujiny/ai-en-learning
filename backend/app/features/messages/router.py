from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.ai_service import ai_service
from app.core.config import settings
from app.core.logging import error_logger
from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.messages.schemas import MessageSendRequest, MessageSendResponse

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/send", response_model=MessageSendResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageSendResponse:
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    user_message = Message(
        conversation_id=conversation.id,
        sender_role="user",
        content=payload.content,
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    history_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.id.asc())
        .all()
    )
    history = [
        {
            "role": "assistant" if message.sender_role == "assistant" else "user",
            "content": message.content,
        }
        for message in history_messages
    ]
    conversation_memory = history[-settings.ai_conversation_memory_limit :]

    effective_system_prompt = conversation.scenario.system_prompt
    if conversation.custom_prompt:
        effective_system_prompt = (
            f"{conversation.scenario.system_prompt}\n\n"
            f"Additional conversation instructions:\n{conversation.custom_prompt}"
        )

    effective_title = conversation.custom_title or conversation.scenario.title
    effective_description = conversation.scenario.description
    if conversation.custom_title:
        effective_description = (
            f"{conversation.scenario.description}\n"
            f"Custom conversation mode: {conversation.custom_title}"
        )

    ai_content = ai_service.generate_reply(
        system_prompt=effective_system_prompt,
        scenario_title=effective_title,
        scenario_description=effective_description,
        scenario_difficulty=conversation.scenario.difficulty,
        target_language=conversation.language,
        conversation_history=conversation_memory,
    )

    assistant_message = Message(
        conversation_id=conversation.id,
        sender_role="assistant",
        content=ai_content,
    )
    db.add(assistant_message)
    try:
        db.commit()
    except Exception:
        db.rollback()
        error_logger.exception(
            "assistant_message_persist_failed conversation_id=%s user_id=%s",
            conversation.id,
            current_user.id,
        )
        raise
    db.refresh(assistant_message)

    return MessageSendResponse(
        conversation_id=conversation.id,
        user_message=user_message,
        ai_message=assistant_message,
    )
