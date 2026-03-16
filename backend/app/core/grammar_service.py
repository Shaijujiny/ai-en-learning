import httpx

from app.core.config import settings
from app.core.logging import error_logger


class GrammarService:
    def analyze_text(self, text: str) -> dict:
        response = httpx.post(
            settings.languagetool_api_url,
            data={
                "text": text,
                "language": settings.languagetool_language,
            },
            timeout=20.0,
        )
        response.raise_for_status()
        return response.json()

    def safe_analyze_text(self, text: str) -> dict | None:
        try:
            return self.analyze_text(text)
        except Exception:
            error_logger.exception("grammar_analysis_failed")
            return None


grammar_service = GrammarService()
