from __future__ import annotations

from sqlalchemy.orm import Session

from app.database.models.personalized_lesson import PersonalizedLesson
from app.database.models.scenario import Scenario
from app.database.models.user import User


class LessonService:
    LESSON_TYPES = [
        ("grammar_lesson", "Grammar lesson"),
        ("vocabulary_lesson", "Vocabulary lesson"),
        ("speaking_task", "Speaking task"),
        ("listening_task", "Listening task"),
        ("writing_task", "Short writing task"),
    ]

    def generate_lessons(
        self,
        *,
        db: Session,
        user: User,
        weakest_skill: str | None,
        recommended_scenario_id: int | None = None,
    ) -> list[PersonalizedLesson]:
        skill = weakest_skill or "fluency"
        scenario = None
        if recommended_scenario_id is not None:
          scenario = db.query(Scenario).filter(Scenario.id == recommended_scenario_id).first()

        existing = (
            db.query(PersonalizedLesson)
            .filter(
                PersonalizedLesson.user_id == user.id,
                PersonalizedLesson.status == "recommended",
            )
            .all()
        )
        for lesson in existing:
            lesson.status = "archived"

        generated: list[PersonalizedLesson] = []
        for lesson_type, label in self.LESSON_TYPES:
            lesson = PersonalizedLesson(
                user_id=user.id,
                recommended_scenario_id=scenario.id if scenario else None,
                lesson_type=lesson_type,
                target_skill=skill,
                title=self.build_title(label, skill),
                instructions=self.build_instructions(
                    lesson_type=lesson_type,
                    target_skill=skill,
                    user_level=user.user_level or "A2",
                    scenario_title=scenario.title if scenario else None,
                ),
                metadata_json={
                    "user_level": user.user_level,
                    "scenario_title": scenario.title if scenario else None,
                },
                status="recommended",
            )
            db.add(lesson)
            generated.append(lesson)

        db.flush()
        return generated

    def build_title(self, label: str, target_skill: str) -> str:
        return f"{label} for {target_skill.replace('_', ' ')}"

    def build_instructions(
        self,
        *,
        lesson_type: str,
        target_skill: str,
        user_level: str,
        scenario_title: str | None,
    ) -> str:
        scenario_context = (
            f"Use the {scenario_title} scenario as practice context. "
            if scenario_title
            else ""
        )
        base = (
            f"Target CEFR level: {user_level}. Focus on {target_skill.replace('_', ' ')}. "
            f"{scenario_context}"
        )

        templates = {
            "grammar_lesson": "Write 5 short sentences, then rewrite them with cleaner grammar and tense control.",
            "vocabulary_lesson": "Use 8 stronger words in context and avoid repeating the same simple verbs.",
            "speaking_task": "Answer one realistic spoken prompt in 4 to 6 sentences with clear structure.",
            "listening_task": "Listen to one AI reply, summarize it, then respond with one relevant follow-up.",
            "writing_task": "Write one short structured response with a clear opening, supporting idea, and closing line.",
        }
        return base + templates[lesson_type]


lesson_service = LessonService()
