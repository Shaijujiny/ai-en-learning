from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.message import Message


class MessageRepository:
    def get_user_conversation(
        self, db: Session, *, conversation_id: int, user_id: int
    ) -> Conversation | None:
        return (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .first()
        )

    def create_message(self, db: Session, message: Message) -> Message:
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    def list_history(self, db: Session, conversation_id: int) -> list[Message]:
        return (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.id.asc())
            .all()
        )


message_repository = MessageRepository()
