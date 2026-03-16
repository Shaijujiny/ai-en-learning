from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import (
    build_response,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import (
    RequestLoggingMiddleware,
    configure_logging,
)
from app.features.analytics.router import router as analytics_router
from app.features.analysis.router import router as analysis_router
from app.features.admin.router import router as admin_router
from app.features.auth.routes import router as auth_router
from app.features.coaching.router import router as coaching_router
from app.features.conversations.routes import router as conversations_router
from app.features.health.router import router as health_router
from app.features.messages.routes import router as messages_router
from app.features.scenarios.routes import router as scenarios_router
from app.features.speech.router import router as speech_router

configure_logging()

allowed_origins = [
    origin.strip()
    for origin in settings.frontend_origins.split(",")
    if origin.strip()
]

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(analysis_router)
app.include_router(auth_router)
app.include_router(coaching_router)
app.include_router(conversations_router)
app.include_router(health_router)
app.include_router(messages_router)
app.include_router(scenarios_router)
app.include_router(speech_router)


@app.get("/", tags=["root"])
def read_root():
    return build_response(
        f"{settings.app_name} is running",
        {"app_name": settings.app_name},
    )
