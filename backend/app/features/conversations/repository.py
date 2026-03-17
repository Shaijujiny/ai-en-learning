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

    def list_user_conversations(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 20
    ) -> tuple[list[Conversation], int]:
        query = db.query(Conversation).filter(Conversation.user_id == user_id)
        total = query.count()
        items = query.order_by(Conversation.created_at.desc()).offset(skip).limit(limit).all()
        return items, total


conversation_repository = ConversationRepository()
