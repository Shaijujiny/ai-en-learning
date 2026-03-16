from fastapi import APIRouter
from app.utils.helpers import build_response

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check():
    return build_response("Health check", {"service": "ok"})
