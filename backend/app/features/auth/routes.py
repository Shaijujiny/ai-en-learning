from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.rate_limit_service import rate_limit_service
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.auth.schema import LoginRequest, RegisterRequest, UserProfile
from app.features.auth.service import auth_service
from app.utils.helpers import build_response

router = APIRouter(prefix="/auth", tags=["auth"])

_AUTH_RATE_LIMIT = 5
_AUTH_WINDOW = 60


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    allowed, _ = rate_limit_service.hit(
        key=f"rate:auth:register:{client_ip}",
        limit=_AUTH_RATE_LIMIT,
        window_seconds=_AUTH_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please wait and try again.",
        )

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
            "assessment_status": user.assessment_status,
            "next_route": "/assessment",
        },
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    allowed, _ = rate_limit_service.hit(
        key=f"rate:auth:login:{client_ip}:{payload.email.lower()}",
        limit=_AUTH_RATE_LIMIT,
        window_seconds=_AUTH_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait and try again.",
        )

    user, access_token = auth_service.login_user(
        db,
        email=payload.email,
        password=payload.password,
    )
    return build_response(
        "Login successful",
        {
            "access_token": access_token,
            "token_type": "bearer",
            "assessment_status": user.assessment_status,
            "next_route": "/assessment" if user.assessment_status == "pending" else "/portal",
        },
    )


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return build_response(
        "User profile",
        UserProfile.model_validate(current_user).model_dump(mode="json"),
    )
