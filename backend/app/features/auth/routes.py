from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.auth.schema import LoginRequest, RegisterRequest, UserProfile
from app.features.auth.service import auth_service
from app.utils.helpers import build_response

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user = auth_service.register_user(
        db,
        name=payload.name,
        email=payload.email,
        password=payload.password,
    )
    return build_response(
        "User registered successfully",
        {
            "user_id": user.id,
            "email": user.email,
        },
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    _, access_token = auth_service.login_user(
        db,
        email=payload.email,
        password=payload.password,
    )
    return build_response(
        "Login successful",
        {
            "access_token": access_token,
            "token_type": "bearer",
        },
    )


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return build_response(
        "User profile",
        UserProfile.model_validate(current_user).model_dump(mode="json"),
    )
