from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.cache import cache_service
from app.core.config import settings
from app.core.security import TokenError, get_token_subject
from app.database.models.user import User
from app.database.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        subject = get_token_subject(token)
    except TokenError as exc:
        raise credentials_exception from exc

    cached_session = cache_service.get_json(f"session:{token}")
    if cached_session is not None:
        user = db.query(User).filter(User.id == cached_session["id"]).first()
        if user is not None and user.is_active:
            return user

    user = db.query(User).filter(User.email == subject).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    admin_emails = {
        email.strip().lower()
        for email in settings.admin_emails.split(",")
        if email.strip()
    }
    if current_user.email.lower() not in admin_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
