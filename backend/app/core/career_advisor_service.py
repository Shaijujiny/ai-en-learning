from openai import OpenAI

from app.core.config import settings
from app.core.logging import ai_logger


class CareerAdvisorService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def generate_advice(
        self,
        *,
        resume_text: str,
        target_role: str,
        focus_area: str,
    ) -> dict:
        if self._client is None:
            return self._fallback_advice(
                resume_text=resume_text,
                target_role=target_role,
                focus_area=focus_area,
            )

        prompt = self._build_prompt(
            resume_text=resume_text,
            target_role=target_role,
            focus_area=focus_area,
        )
        response = self._client.responses.create(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert career advisor. Return concise, practical advice "
                        "for resume feedback, career advice, and mock interview preparation."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        text = response.output_text.strip()
        ai_logger.info("career_advice_generated provider=openai target_role=%s", target_role)
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

    def _fallback_advice(
        self,
        *,
        resume_text: str,
        target_role: str,
        focus_area: str,
    ) -> dict:
        word_count = len(resume_text.split())
        resume_feedback = [
            "Quantify impact with numbers where possible.",
            "Make bullet points action-oriented and result-focused.",
        ]
        if word_count < 80:
            resume_feedback.append("Add more detail about projects, outcomes, and responsibilities.")
        if "python" not in resume_text.lower() and "api" not in resume_text.lower():
            resume_feedback.append("Highlight concrete technical tools and domain-specific skills more clearly.")

        career_advice = [
            f"Align your resume examples more directly with the expectations of a {target_role} role.",
            "Build a few strong project stories that show ownership, problem solving, and measurable outcomes.",
        ]
        if focus_area:
            career_advice.append(f"Spend extra preparation time on {focus_area}.")

        mock_interview_preparation = [
            "Prepare 3-5 STAR stories that show technical decision-making and collaboration.",
            "Practice explaining tradeoffs, challenges, and measurable results out loud.",
            f"Review likely questions for {target_role} and rehearse concise, structured answers.",
        ]

        return {
            "summary": f"Generated practical career guidance for {target_role}.",
            "resume_feedback": resume_feedback[:4],
            "career_advice": career_advice[:4],
            "mock_interview_preparation": mock_interview_preparation[:4],
        }

    def _split_lines(self, text: str, *, limit: int) -> list[str]:
        lines = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return ["No specific guidance generated."]
        return lines[:limit]


career_advisor_service = CareerAdvisorService()
