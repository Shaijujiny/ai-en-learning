from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.user import User
from app.features.conversations.repository import conversation_repository
from app.features.conversations.schema import (
    ConversationDetailResponse,
    ConversationStartRequest,
    ConversationStartResponse,
)


class ConversationService:
    def start_conversation(
        self,
        db: Session,
        *,
        payload: ConversationStartRequest,
        current_user: User,
    ) -> dict:
        scenario = conversation_repository.get_scenario(db, payload.scenario_id)
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
        conversation = conversation_repository.create_conversation(db, conversation)
        db.commit()
        db.refresh(conversation)
        return ConversationStartResponse.model_validate(conversation).model_dump(mode="json")

    def get_conversation(self, db: Session, *, conversation_id: int, current_user: User) -> dict:
        conversation = conversation_repository.get_user_conversation(
            db,
            conversation_id=conversation_id,
            user_id=current_user.id,
        )
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return ConversationDetailResponse.model_validate(conversation).model_dump(mode="json")


conversation_service = ConversationService()
