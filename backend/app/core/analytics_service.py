from collections import defaultdict

from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.mistake_memory import MistakeMemory
from app.database.models.personalized_lesson import PersonalizedLesson
from app.database.models.scenario import Scenario
from app.database.models.skill_metric import SkillMetric
from app.database.models.user import User
from app.database.models.user_level_history import UserLevelHistory
from app.database.models.user_score import UserScore


class AnalyticsService:
    def record_score(
        self,
        *,
        db: Session,
        user_id: int,
        conversation_id: int | None,
        score_type: str,
        score_value: float,
        feedback: str | None = None,
    ) -> UserScore:
        score = UserScore(
            user_id=user_id,
            conversation_id=conversation_id,
            score_type=score_type,
            score_value=score_value,
            feedback=feedback,
        )
        db.add(score)
        db.flush()
        return score

    def upsert_skill_metric(
        self,
        *,
        db: Session,
        user_id: int,
        skill_name: str,
        metric_value: float,
    ) -> SkillMetric:
        metric = (
            db.query(SkillMetric)
            .filter(SkillMetric.user_id == user_id, SkillMetric.skill_name == skill_name)
            .first()
        )
        if metric is None:
            metric = SkillMetric(
                user_id=user_id,
                skill_name=skill_name,
                metric_value=metric_value,
                sample_count=1,
            )
            db.add(metric)
            db.flush()
            return metric

        previous_count = metric.sample_count
        previous_value = float(metric.metric_value)
        metric.metric_value = round(
            ((previous_value * previous_count) + metric_value) / (previous_count + 1),
            2,
        )
        metric.sample_count = previous_count + 1
        db.flush()
        return metric

    def build_dashboard(self, *, db: Session, user_id: int) -> dict:
        user = db.query(User).filter(User.id == user_id).first()
        scores = (
            db.query(UserScore)
            .filter(UserScore.user_id == user_id)
            .order_by(UserScore.created_at.desc())
            .all()
        )
        skill_metrics = (
            db.query(SkillMetric)
            .filter(SkillMetric.user_id == user_id)
            .order_by(SkillMetric.skill_name.asc())
            .all()
        )
        conversations = (
            db.query(Conversation, Scenario.title)
            .join(Scenario, Conversation.scenario_id == Scenario.id)
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.created_at.desc())
            .all()
        )
        level_history = (
            db.query(UserLevelHistory)
            .filter(UserLevelHistory.user_id == user_id)
            .order_by(UserLevelHistory.created_at.desc())
            .limit(8)
            .all()
        )
        lessons = (
            db.query(PersonalizedLesson, Scenario.title)
            .outerjoin(Scenario, PersonalizedLesson.recommended_scenario_id == Scenario.id)
            .filter(
                PersonalizedLesson.user_id == user_id,
                PersonalizedLesson.status == "recommended",
            )
            .order_by(PersonalizedLesson.created_at.desc())
            .limit(5)
            .all()
        )
        mistakes = (
            db.query(MistakeMemory)
            .filter(MistakeMemory.user_id == user_id)
            .order_by(MistakeMemory.occurrence_count.desc(), MistakeMemory.updated_at.desc())
            .limit(6)
            .all()
        )

        score_values = [float(score.score_value) for score in scores]
        performance_score = round(sum(score_values) / len(score_values), 1) if score_values else 0.0

        trend_by_type: dict[str, list[dict]] = defaultdict(list)
        for score in reversed(scores[-12:]):
            trend_by_type[score.score_type].append(
                {
                    "label": score.created_at.strftime("%b %d"),
                    "value": float(score.score_value),
                }
            )

        history_items = []
        for conversation, scenario_title in conversations[:12]:
            latest_message = (
                db.query(Message)
                .filter(Message.conversation_id == conversation.id)
                .order_by(Message.id.desc())
                .first()
            )
            message_count = (
                db.query(Message)
                .filter(Message.conversation_id == conversation.id)
                .count()
            )
            history_items.append(
                {
                    "conversation_id": conversation.id,
                    "scenario_title": scenario_title,
                    "status": conversation.status,
                    "message_count": message_count,
                    "started_at": conversation.started_at,
                    "latest_message": latest_message.content if latest_message else None,
                }
            )

        return {
            "performance_score": performance_score,
            "current_level": user.user_level if user else None,
            "level_confidence_score": float(level_history[0].confidence_score) if level_history else 0.0,
            "level_history": [
                {
                    "level": item.level,
                    "confidence_score": float(item.confidence_score),
                    "source": item.source,
                    "created_at": item.created_at,
                }
                for item in reversed(level_history)
            ],
            "skill_metrics": [
                {
                    "skill_name": metric.skill_name,
                    "metric_value": float(metric.metric_value),
                    "sample_count": metric.sample_count,
                    "updated_at": metric.updated_at,
                }
                for metric in skill_metrics
            ],
            "improvement_trends": [
                {"score_type": score_type, "points": points}
                for score_type, points in trend_by_type.items()
            ],
            "personalized_lessons": [
                {
                    "id": lesson.id,
                    "lesson_type": lesson.lesson_type,
                    "target_skill": lesson.target_skill,
                    "title": lesson.title,
                    "instructions": lesson.instructions,
                    "status": lesson.status,
                    "recommended_scenario": scenario_title,
                    "created_at": lesson.created_at,
                }
                for lesson, scenario_title in lessons
            ],
            "mistake_memory": [
                {
                    "mistake_type": mistake.mistake_type,
                    "mistake_key": mistake.mistake_key,
                    "hint": mistake.hint,
                    "correction": mistake.correction,
                    "occurrence_count": mistake.occurrence_count,
                    "last_seen_at": mistake.last_seen_at,
                }
                for mistake in mistakes
            ],
            "conversation_history": history_items,
        }


analytics_service = AnalyticsService()
