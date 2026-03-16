from sqlalchemy.orm import Session

from app.database.models.user import User


class AuthRepository:
    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    def create_user(self, db: Session, *, email: str, full_name: str, hashed_password: str) -> User:
        user = User(email=email, full_name=full_name, hashed_password=hashed_password)
        db.add(user)
        db.flush()
        db.refresh(user)
        return user


auth_repository = AuthRepository()
