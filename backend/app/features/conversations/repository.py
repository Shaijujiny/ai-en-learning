from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.scenario import Scenario


class ConversationRepository:
    def get_scenario(self, db: Session, scenario_id: int) -> Scenario | None:
        return db.query(Scenario).filter(Scenario.id == scenario_id).first()

    def create_conversation(self, db: Session, conversation: Conversation) -> Conversation:
        db.add(conversation)
        db.flush()
        db.refresh(conversation)
        return conversation

    def get_user_conversation(
        self, db: Session, *, conversation_id: int, user_id: int
    ) -> Conversation | None:
        return (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .first()
        )


conversation_repository = ConversationRepository()
