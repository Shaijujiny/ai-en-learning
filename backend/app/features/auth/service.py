from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.cache import cache_service
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.database.models.user import User
from app.features.auth.repository import auth_repository


class AuthService:
    def register_user(self, db: Session, *, name: str, email: str, password: str) -> User:
        existing_user = auth_repository.get_by_email(db, email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )

        user = auth_repository.create_user(
            db,
            email=email,
            full_name=name,
            hashed_password=hash_password(password),
        )
        db.commit()
        db.refresh(user)
        return user

    def login_user(self, db: Session, *, email: str, password: str) -> tuple[User, str, str]:
        user = auth_repository.get_by_email(db, email)
        if user is None or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(user.email)
        refresh_token = create_refresh_token(user.email)
        
        cache_service.set_json(
            f"session:{access_token}",
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
            },
            settings.redis_session_ttl_seconds,
        )
        return user, access_token, refresh_token


auth_service = AuthService()
