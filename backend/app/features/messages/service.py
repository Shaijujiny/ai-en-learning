from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.models.message import Message
from app.database.models.user import User
from app.features.ai_chat.ai_service import ai_chat_service
from app.features.messages.repository import message_repository
from app.features.messages.schema import MessageSendRequest, MessageSendResponse


class MessageService:
    def send_message(
        self,
        db: Session,
        *,
        payload: MessageSendRequest,
        current_user: User,
    ) -> dict:
        conversation = message_repository.get_user_conversation(
            db,
            conversation_id=payload.conversation_id,
            user_id=current_user.id,
        )
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        try:
            user_message = message_repository.create_message(
                db,
                Message(
                    conversation_id=conversation.id,
                    sender_role="user",
                    content=payload.content,
                ),
            )

            history_messages = message_repository.list_history(db, conversation.id)
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

            ai_content = ai_chat_service.generate_reply(
                system_prompt=effective_system_prompt,
                scenario_title=effective_title,
                scenario_description=effective_description,
                scenario_difficulty=conversation.scenario.difficulty,
                target_language=conversation.language,
                conversation_history=conversation_memory,
            )

            assistant_message = message_repository.create_message(
                db,
                Message(
                    conversation_id=conversation.id,
                    sender_role="assistant",
                    content=ai_content,
                ),
            )
            db.commit()
            db.refresh(user_message)
            db.refresh(assistant_message)
            return MessageSendResponse.model_validate(
                {
                    "conversation_id": conversation.id,
                    "user_message": user_message,
                    "ai_message": assistant_message,
                }
            ).model_dump(mode="json")
        except Exception:
            db.rollback()
            raise


message_service = MessageService()
