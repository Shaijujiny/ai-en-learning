from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Interview Platform API"
    app_env: str = "development"
    database_url: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/ai_interview_platform"
    )
    frontend_origins: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:3001,"
        "http://127.0.0.1:3001"
    )
    frontend_origin: str | None = None
    admin_emails: str = ""
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_whisper_model: str = "whisper-1"
    openai_tts_model: str = "gpt-4o-mini-tts"
    openai_tts_voice: str = "alloy"
    openai_tts_format: str = "mp3"
    speech_max_upload_mb: int = 8
    speech_transcribe_per_minute: int = 20
    speech_synthesize_per_minute: int = 30
    languagetool_api_url: str = "https://api.languagetool.org/v2/check"
    languagetool_language: str = "en-US"
    redis_url: str | None = None
    redis_session_ttl_seconds: int = 3600
    redis_ai_cache_ttl_seconds: int = 1800
    ai_conversation_memory_limit: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def apply_legacy_frontend_origin(self) -> "Settings":
        if self.frontend_origin and not self.frontend_origins:
            self.frontend_origins = self.frontend_origin
        elif self.frontend_origin and self.frontend_origin not in self.frontend_origins:
            self.frontend_origins = f"{self.frontend_origins},{self.frontend_origin}"
        return self

    @model_validator(mode="after")
    def ensure_prod_secrets(self) -> "Settings":
        if (self.app_env or "").lower() in {"production", "prod"} and self.jwt_secret_key == "change-me-in-production":
            raise ValueError("JWT_SECRET_KEY must be set in production.")
        return self


settings = Settings()
