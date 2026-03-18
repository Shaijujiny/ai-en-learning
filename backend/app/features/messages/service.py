import json

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.credit_service import credit_service
from app.core.mistake_memory_service import mistake_memory_service
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
            # Deduct credit: every 5 messages = 1 credit. Blocks at 0.
            credit_service.consume_message(db, user_id=current_user.id)

            user_message = message_repository.create_message(
                db,
                Message(
                    conversation_id=conversation.id,
                    sender_role="user",
                    content=payload.content,
                ),
            )

            history_messages = message_repository.list_history(
                db, conversation.id, limit=settings.ai_conversation_memory_limit
            )
            conversation_memory = [
                {"role": "assistant" if m.sender_role == "assistant" else "user", "content": m.content}
                for m in history_messages
            ]

            _COACH_PERSONALITIES: dict[str, str] = {
                "friendly": (
                    "PERSONALITY: Be warm, encouraging, and patient. "
                    "Celebrate small wins. Give detailed, supportive explanations. "
                    "Correct mistakes gently with examples."
                ),
                "strict": (
                    "PERSONALITY: Be professional and demanding. Hold high standards. "
                    "Point out every mistake directly and clearly. No easy passes — "
                    "push the user to do better."
                ),
                "casual": (
                    "PERSONALITY: Be relaxed and conversational, like a friend. "
                    "Keep things light and fun. Encourage naturally without formal structure."
                ),
            }

            effective_system_prompt = conversation.scenario.system_prompt
            if conversation.custom_prompt:
                effective_system_prompt = (
                    f"{conversation.scenario.system_prompt}\n\n"
                    f"Additional conversation instructions:\n{conversation.custom_prompt}"
                )
            if payload.coach_mode and payload.coach_mode in _COACH_PERSONALITIES:
                effective_system_prompt = (
                    f"{effective_system_prompt}\n\n"
                    f"{_COACH_PERSONALITIES[payload.coach_mode]}"
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
                current_level=current_user.user_level,
                skill_breakdown=current_user.skill_breakdown or {},
                correction_mode=conversation.correction_mode,
                mistake_memory=[
                    {
                        "mistake_type": item.mistake_type,
                        "hint": item.hint,
                        "correction": item.correction,
                    }
                    for item in mistake_memory_service.top_mistakes(
                        db=db,
                        user_id=current_user.id,
                        limit=4,
                    )
                ],
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

    def stream_message(
        self,
        db: Session,
        *,
        payload: MessageSendRequest,
        current_user: User,
    ) -> StreamingResponse:
        conversation = message_repository.get_user_conversation(
            db,
            conversation_id=payload.conversation_id,
            user_id=current_user.id,
        )
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        try:
            credit_service.consume_message(db, user_id=current_user.id)
            user_message = message_repository.create_message(
                db,
                Message(conversation_id=conversation.id, sender_role="user", content=payload.content),
            )
            db.flush()
        except Exception:
            db.rollback()
            raise

        history_messages = message_repository.list_history(
            db, conversation.id, limit=settings.ai_conversation_memory_limit
        )
        history = [
            {"role": "assistant" if m.sender_role == "assistant" else "user", "content": m.content}
            for m in history_messages
        ]

        _COACH_PERSONALITIES: dict[str, str] = {
            "friendly": (
                "PERSONALITY: Be warm, encouraging, and patient. "
                "Celebrate small wins. Give detailed, supportive explanations. "
                "Correct mistakes gently with examples."
            ),
            "strict": (
                "PERSONALITY: Be professional and demanding. Hold high standards. "
                "Point out every mistake directly and clearly. No easy passes — "
                "push the user to do better."
            ),
            "casual": (
                "PERSONALITY: Be relaxed and conversational, like a friend. "
                "Keep things light and fun. Encourage naturally without formal structure."
            ),
        }

        effective_system_prompt = conversation.scenario.system_prompt
        if conversation.custom_prompt:
            effective_system_prompt = (
                f"{conversation.scenario.system_prompt}\n\n"
                f"Additional conversation instructions:\n{conversation.custom_prompt}"
            )
        if payload.coach_mode and payload.coach_mode in _COACH_PERSONALITIES:
            effective_system_prompt = (
                f"{effective_system_prompt}\n\n{_COACH_PERSONALITIES[payload.coach_mode]}"
            )

        effective_title = conversation.custom_title or conversation.scenario.title
        effective_description = conversation.scenario.description
        if conversation.custom_title:
            effective_description = (
                f"{conversation.scenario.description}\n"
                f"Custom conversation mode: {conversation.custom_title}"
            )

        mistake_mem = [
            {"mistake_type": item.mistake_type, "hint": item.hint, "correction": item.correction}
            for item in mistake_memory_service.top_mistakes(db=db, user_id=current_user.id, limit=4)
        ]

        def event_generator():
            full_content = ""
            try:
                for token in ai_chat_service.generate_reply_stream(
                    system_prompt=effective_system_prompt,
                    scenario_title=effective_title,
                    scenario_description=effective_description,
                    scenario_difficulty=conversation.scenario.difficulty,
                    target_language=conversation.language,
                    conversation_history=history,
                    current_level=current_user.user_level,
                    skill_breakdown=current_user.skill_breakdown or {},
                    correction_mode=conversation.correction_mode,
                    mistake_memory=mistake_mem,
                ):
                    full_content += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            except Exception:
                db.rollback()
                yield f"data: {json.dumps({'type': 'error', 'message': 'AI error, please try again'})}\n\n"
                return

            try:
                ai_msg = message_repository.create_message(
                    db,
                    Message(conversation_id=conversation.id, sender_role="assistant", content=full_content),
                )
                db.commit()
                db.refresh(user_message)
                db.refresh(ai_msg)
                done_payload = MessageSendResponse.model_validate(
                    {"conversation_id": conversation.id, "user_message": user_message, "ai_message": ai_msg}
                ).model_dump(mode="json")
                yield f"data: {json.dumps({'type': 'done', **done_payload})}\n\n"
            except Exception:
                db.rollback()
                yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to save response'})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )


message_service = MessageService()
