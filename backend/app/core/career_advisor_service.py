from app.core.ai_client import AIClient
from app.core.logging import ai_logger


class CareerAdvisorService:
    def __init__(self) -> None:
        self._ai = AIClient()

    def generate_advice(
        self,
        *,
        resume_text: str,
        target_role: str,
        focus_area: str,
    ) -> dict:
        if not self._ai.available:
            return {
                "summary": (
                    f"Career advice is unavailable. AI_PROVIDER='{self._ai.provider}' "
                    f"but the corresponding API key is not configured."
                ),
                "resume_feedback": [],
                "career_advice": [],
                "mock_interview_preparation": [],
            }

        prompt = self._build_prompt(
            resume_text=resume_text,
            target_role=target_role,
            focus_area=focus_area,
        )
        text = self._ai.create_message(
            system=(
                "You are an expert career advisor. Return concise, practical advice "
                "for resume feedback, career advice, and mock interview preparation."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        ai_logger.info(
            "career_advice_generated provider=%s target_role=%s",
            self._ai.provider,
            target_role,
        )
        return {
            "summary": f"Career guidance prepared for {target_role}.",
            "resume_feedback": self._split_lines(text, limit=4),
            "career_advice": self._split_lines(text, limit=4),
            "mock_interview_preparation": self._split_lines(text, limit=4),
        }

    def _build_prompt(self, *, resume_text: str, target_role: str, focus_area: str) -> str:
        return (
            f"Target role: {target_role}\n"
            f"Focus area: {focus_area}\n"
            f"Resume text:\n{resume_text}\n\n"
            "Provide:\n"
            "1. Resume feedback\n"
            "2. Career advice\n"
            "3. Mock interview preparation tips\n"
            "Keep each section actionable and concise."
        )

    def _split_lines(self, text: str, *, limit: int) -> list[str]:
        lines = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return ["No specific guidance generated."]
        return lines[:limit]


career_advisor_service = CareerAdvisorService()
