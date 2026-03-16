from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.analytics_service import analytics_service
from app.core.cefr_service import cefr_service
from app.core.fluency_service import fluency_service
from app.core.grammar_service import grammar_service
from app.core.lesson_service import lesson_service
from app.core.vocabulary_service import vocabulary_service
from app.database.models.assessment_answer import AssessmentAnswer
from app.database.models.assessment_session import AssessmentSession
from app.database.models.scenario import Scenario, ScenarioDifficulty
from app.database.models.user import User
from app.features.assessment.schema import (
    AssessmentAnswerInput,
    AssessmentQuestion,
    AssessmentResultData,
    PracticeRecommendation,
)


class AssessmentService:
    QUESTIONS: list[AssessmentQuestion] = [
        AssessmentQuestion(
            key="self_intro",
            order=1,
            category="self_introduction",
            title="Introduce yourself",
            prompt="Introduce yourself in English and explain what kind of practice you want from this platform.",
            placeholder="Write 3 to 5 sentences about yourself, your work or studies, and your learning goal.",
        ),
        AssessmentQuestion(
            key="daily_routine",
            order=2,
            category="daily_routine",
            title="Describe your daily routine",
            prompt="Describe your typical weekday routine from morning to evening.",
            placeholder="Explain your routine clearly and use time expressions like usually, before, after, and sometimes.",
        ),
        AssessmentQuestion(
            key="past_experience",
            order=3,
            category="past_experience",
            title="Talk about a past experience",
            prompt="Describe a challenge you faced in the past and how you handled it.",
            placeholder="Use past tense and explain the situation, action, and result.",
        ),
        AssessmentQuestion(
            key="opinion",
            order=4,
            category="opinion",
            title="Share your opinion",
            prompt="Do you think AI tools help people learn English faster? Explain your opinion.",
            placeholder="Give your view and support it with reasons or examples.",
        ),
        AssessmentQuestion(
            key="roleplay",
            order=5,
            category="roleplay",
            title="Respond in a roleplay",
            prompt="Imagine you are in a job interview. Answer this question: Why should we hire you?",
            placeholder="Answer as if you are speaking to an interviewer.",
        ),
        AssessmentQuestion(
            key="grammar_vocabulary",
            order=6,
            category="grammar_vocabulary",
            title="Use richer language",
            prompt="Write a short response about teamwork using these words naturally: collaborate, reliable, improve.",
            placeholder="Use all three words in a natural response.",
        ),
        AssessmentQuestion(
            key="follow_up",
            order=7,
            category="follow_up",
            title="Handle a follow-up question",
            prompt="If a customer is upset because an order is delayed, what would you say to calm the situation?",
            placeholder="Write a calm, polite response that solves the problem.",
        ),
    ]

    def get_questions(self) -> list[AssessmentQuestion]:
        return self.QUESTIONS

    def get_latest_session(self, db: Session, *, user_id: int) -> AssessmentSession | None:
        return (
            db.query(AssessmentSession)
            .options(joinedload(AssessmentSession.recommended_scenario))
            .filter(AssessmentSession.user_id == user_id)
            .order_by(AssessmentSession.created_at.desc())
            .first()
        )

    def get_overview(self, db: Session, *, user: User) -> dict:
        latest_session = self.get_latest_session(db, user_id=user.id)
        latest_result = (
            self.serialize_result(latest_session) if latest_session and latest_session.status == "completed" else None
        )
        return {
            "status": user.assessment_status,
            "current_level": user.user_level,
            "questions": [question.model_dump() for question in self.get_questions()],
            "latest_result": latest_result.model_dump(mode="json") if latest_result else None,
        }

    def skip_onboarding(self, db: Session, *, user: User) -> dict:
        session = AssessmentSession(
            user_id=user.id,
            status="skipped",
            question_count=len(self.QUESTIONS),
            skipped_at=datetime.now(timezone.utc),
            completion_notes="User chose to skip onboarding assessment for now.",
        )
        db.add(session)
        user.assessment_status = "skipped"
        db.commit()
        return {
            "status": "skipped",
            "next_route": "/portal",
        }

    def submit_onboarding(
        self, db: Session, *, user: User, answers: list[AssessmentAnswerInput]
    ) -> AssessmentResultData:
        expected = {question.key: question for question in self.QUESTIONS}
        provided = {answer.question_key: answer for answer in answers}

        if set(provided.keys()) != set(expected.keys()):
            missing = sorted(set(expected.keys()) - set(provided.keys()))
            extra = sorted(set(provided.keys()) - set(expected.keys()))
            detail_parts = []
            if missing:
                detail_parts.append(f"missing answers: {', '.join(missing)}")
            if extra:
                detail_parts.append(f"unexpected answers: {', '.join(extra)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Assessment answers are incomplete: " + "; ".join(detail_parts),
            )

        session = AssessmentSession(
            user_id=user.id,
            status="completed",
            question_count=len(self.QUESTIONS),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.flush()

        ordered_answers: list[AssessmentAnswer] = []
        combined_text_parts: list[str] = []
        for question in self.QUESTIONS:
            payload = provided[question.key]
            answer = AssessmentAnswer(
                session_id=session.id,
                user_id=user.id,
                question_key=question.key,
                question_text=question.prompt,
                question_category=question.category,
                question_order=question.order,
                answer_text=payload.answer_text.strip(),
                answer_type=payload.answer_type,
            )
            db.add(answer)
            ordered_answers.append(answer)
            combined_text_parts.append(payload.answer_text.strip())

        combined_text = "\n\n".join(combined_text_parts)
        grammar_result = grammar_service.safe_analyze_text(combined_text) or {"matches": []}
        grammar_match_count = len(grammar_result.get("matches", []))
        fluency_result = fluency_service.analyze(combined_text, grammar_match_count)
        vocabulary_result = vocabulary_service.analyze(combined_text)
        score_summary = self.build_score_summary(
            combined_text=combined_text,
            grammar_match_count=grammar_match_count,
            fluency_result=fluency_result,
            vocabulary_result=vocabulary_result,
        )
        user_level = cefr_service.estimate_level(score_summary["overall_score"])
        strongest_skill, weakest_skill = self.identify_skill_edges(score_summary["skill_breakdown"])
        recommended_scenario = self.select_recommended_scenario(
            db=db,
            weakest_skill=weakest_skill,
            user_level=user_level,
        )
        recommended_path = self.build_recommended_path(
            weakest_skill=weakest_skill,
            strongest_skill=strongest_skill,
        )

        session.user_level = user_level
        session.strongest_skill = strongest_skill
        session.weakest_skill = weakest_skill
        session.recommended_scenario_id = recommended_scenario.id if recommended_scenario else None
        session.score_summary = score_summary["score_summary"]
        session.skill_breakdown = score_summary["skill_breakdown"]
        session.recommended_path = [item.model_dump() for item in recommended_path]
        session.completion_notes = self.build_completion_notes(
            user_level=user_level,
            strongest_skill=strongest_skill,
            weakest_skill=weakest_skill,
        )

        user.assessment_status = "completed"
        user.recommended_path = [item.model_dump() for item in recommended_path]
        cefr_service.update_user_level(
            db=db,
            user=user,
            overall_score=score_summary["overall_score"],
            skill_breakdown=score_summary["skill_breakdown"],
            source="onboarding_assessment",
            sample_count=len(self.QUESTIONS),
        )

        analytics_service.record_score(
            db=db,
            user_id=user.id,
            conversation_id=None,
            score_type="assessment_overall",
            score_value=score_summary["overall_score"],
            feedback=session.completion_notes,
        )
        for skill_name, metric_value in score_summary["skill_breakdown"].items():
            analytics_service.upsert_skill_metric(
                db=db,
                user_id=user.id,
                skill_name=skill_name,
                metric_value=metric_value,
            )
        lesson_service.generate_lessons(
            db=db,
            user=user,
            weakest_skill=weakest_skill,
            recommended_scenario_id=recommended_scenario.id if recommended_scenario else None,
        )

        db.commit()
        db.refresh(session)
        return self.serialize_result(session, recommended_scenario)

    def get_result(self, db: Session, *, user: User) -> AssessmentResultData:
        session = (
            db.query(AssessmentSession)
            .options(joinedload(AssessmentSession.recommended_scenario))
            .filter(
                AssessmentSession.user_id == user.id,
                AssessmentSession.status == "completed",
            )
            .order_by(AssessmentSession.completed_at.desc(), AssessmentSession.id.desc())
            .first()
        )
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No completed assessment found",
            )
        return self.serialize_result(session)

    def serialize_result(
        self,
        session: AssessmentSession,
        recommended_scenario: Scenario | None = None,
    ) -> AssessmentResultData:
        scenario = recommended_scenario or session.recommended_scenario
        practice_path = [
            PracticeRecommendation.model_validate(item)
            for item in (session.recommended_path or [])
        ]
        return AssessmentResultData(
            session_id=session.id,
            status=session.status,
            current_level=session.user_level,
            strongest_skill=session.strongest_skill,
            weakest_skill=session.weakest_skill,
            recommended_first_scenario=scenario.title if scenario else None,
            recommended_first_scenario_id=scenario.id if scenario else None,
            seven_day_practice_suggestion=practice_path,
            skill_breakdown=session.skill_breakdown or {},
            score_summary=session.score_summary or {},
            completion_notes=session.completion_notes,
            completed_at=session.completed_at,
        )

    def build_score_summary(
        self,
        *,
        combined_text: str,
        grammar_match_count: int,
        fluency_result: dict,
        vocabulary_result: dict,
    ) -> dict:
        sentences = fluency_service.extract_sentences(combined_text)
        words = fluency_service.extract_words(combined_text)
        completeness_score = self.calculate_completeness_score(
            answer_count=len(sentences),
            word_count=len(words),
        )
        confidence_score = self.calculate_confidence_score(combined_text)
        skill_breakdown = {
            "grammar_accuracy": float(fluency_result["grammar_accuracy_score"]),
            "fluency": float(fluency_result["overall_score"]),
            "vocabulary_diversity": float(vocabulary_result["word_diversity_score"]),
            "confidence": confidence_score,
            "sentence_complexity": float(fluency_result["sentence_complexity_score"]),
            "answer_completeness": completeness_score,
        }
        overall_score = round(sum(skill_breakdown.values()) / len(skill_breakdown), 1)
        return {
            "overall_score": overall_score,
            "skill_breakdown": skill_breakdown,
            "score_summary": {
                "overall_score": overall_score,
                "grammar_match_count": grammar_match_count,
                "word_count": len(words),
                "sentence_count": len(sentences),
                "fluency_summary": fluency_result["summary"],
                "vocabulary_summary": vocabulary_result["summary"],
            },
        }

    def calculate_completeness_score(self, *, answer_count: int, word_count: int) -> float:
        sentence_score = min(answer_count * 12, 55)
        word_score = min(word_count * 1.1, 45)
        return round(min(sentence_score + word_score, 100), 1)

    def calculate_confidence_score(self, text: str) -> float:
        lowered = text.lower()
        filler_penalty = sum(lowered.count(token) for token in (" um ", " uh ", " maybe ", " i think "))
        words = fluency_service.extract_words(text)
        long_answer_bonus = 10 if len(words) >= 80 else 5 if len(words) >= 50 else 0
        score = 72 + long_answer_bonus - (filler_penalty * 6)
        return round(max(min(score, 100), 25), 1)

    def identify_skill_edges(self, skill_breakdown: dict[str, float]) -> tuple[str, str]:
        strongest = max(skill_breakdown, key=skill_breakdown.get)
        weakest = min(skill_breakdown, key=skill_breakdown.get)
        return strongest, weakest

    def select_recommended_scenario(
        self,
        *,
        db: Session,
        weakest_skill: str,
        user_level: str,
    ) -> Scenario | None:
        scenarios = db.query(Scenario).order_by(Scenario.id.asc()).all()
        if not scenarios:
            return None

        difficulty_map = {
            "A1": ScenarioDifficulty.BEGINNER.value,
            "A2": ScenarioDifficulty.BEGINNER.value,
            "B1": ScenarioDifficulty.INTERMEDIATE.value,
            "B2": ScenarioDifficulty.INTERMEDIATE.value,
            "C1": ScenarioDifficulty.ADVANCED.value,
            "C2": ScenarioDifficulty.ADVANCED.value,
        }
        preferred_difficulty = difficulty_map[user_level]
        filtered = [scenario for scenario in scenarios if scenario.difficulty == preferred_difficulty]
        candidates = filtered or scenarios

        weakness_hint = weakest_skill.lower()
        for scenario in candidates:
            title = scenario.title.lower()
            description = scenario.description.lower()
            if "confidence" in weakness_hint and ("casual" in title or "conversation" in title):
                return scenario
            if "grammar" in weakness_hint and ("support" in title or "support" in description):
                return scenario
            if "vocabulary" in weakness_hint and ("interview" in title or "business" in title):
                return scenario
            if "completeness" in weakness_hint and ("interview" in title or "meeting" in title):
                return scenario

        return candidates[0]

    def build_recommended_path(
        self, *, weakest_skill: str, strongest_skill: str
    ) -> list[PracticeRecommendation]:
        weakness_label = weakest_skill.replace("_", " ")
        strength_label = strongest_skill.replace("_", " ")
        return [
            PracticeRecommendation(
                day=1,
                focus=weakness_label.title(),
                action="Complete one short speaking answer and rewrite it with clearer structure.",
                target_skill=weakest_skill,
            ),
            PracticeRecommendation(
                day=2,
                focus="Grammar control",
                action="Practice a scenario and review every verb tense correction before the next session.",
                target_skill="grammar_accuracy",
            ),
            PracticeRecommendation(
                day=3,
                focus="Vocabulary range",
                action="Use 5 stronger English words in a roleplay answer and save them for review.",
                target_skill="vocabulary_diversity",
            ),
            PracticeRecommendation(
                day=4,
                focus="Longer answers",
                action="Answer one interview-style question with situation, action, and result.",
                target_skill="answer_completeness",
            ),
            PracticeRecommendation(
                day=5,
                focus="Confidence",
                action="Record one spoken answer without fillers and replay it once.",
                target_skill="confidence",
            ),
            PracticeRecommendation(
                day=6,
                focus=strength_label.title(),
                action="Use your strongest skill intentionally in a more difficult scenario.",
                target_skill=strongest_skill,
            ),
            PracticeRecommendation(
                day=7,
                focus="Review",
                action="Repeat your first scenario and compare the second answer to the first one.",
                target_skill=weakest_skill,
            ),
        ]

    def build_completion_notes(
        self,
        *,
        user_level: str,
        strongest_skill: str,
        weakest_skill: str,
    ) -> str:
        return (
            f"Estimated level is {user_level}. Your strongest skill is "
            f"{strongest_skill.replace('_', ' ')}, and your main focus area is "
            f"{weakest_skill.replace('_', ' ')}."
        )


assessment_service = AssessmentService()
