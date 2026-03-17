from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

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

    def build_dashboard(
        self,
        *,
        db: Session,
        user_id: int,
        days: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        scenario_id: int | None = None,
        language: str | None = None,
        score_type: str | None = None,
        level: str | None = None,
        mistake_type: str | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        if days is not None and days > 0:
            date_from = (now - timedelta(days=days)).date()
        if date_to is None:
            date_to = now.date()

        start_dt = (
            datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc)
            if date_from
            else None
        )
        end_dt = datetime.combine(date_to, datetime.max.time(), tzinfo=timezone.utc)

        conversation_filter = db.query(Conversation.id).filter(Conversation.user_id == user_id)
        if scenario_id is not None:
            conversation_filter = conversation_filter.filter(Conversation.scenario_id == scenario_id)
        if language:
            conversation_filter = conversation_filter.filter(Conversation.language == language)
        conversation_ids = [row[0] for row in conversation_filter.all()]

        user = db.query(User).filter(User.id == user_id).first()
        scores_query = db.query(UserScore).filter(UserScore.user_id == user_id)
        if start_dt is not None:
            scores_query = scores_query.filter(UserScore.created_at >= start_dt)
        scores_query = scores_query.filter(UserScore.created_at <= end_dt)
        if score_type:
            scores_query = scores_query.filter(UserScore.score_type == score_type)
        if scenario_id is not None or language:
            # When filtering by scenario/language, focus on conversation-linked scores.
            if conversation_ids:
                scores_query = scores_query.filter(UserScore.conversation_id.in_(conversation_ids))
            else:
                scores_query = scores_query.filter(UserScore.conversation_id.is_(None))

        scores = scores_query.order_by(UserScore.created_at.desc()).all()
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
        )
        if scenario_id is not None or language:
            if conversation_ids:
                conversations = conversations.filter(Conversation.id.in_(conversation_ids))
            else:
                conversations = conversations.filter(Conversation.id == -1)
        if start_dt is not None:
            conversations = conversations.filter(Conversation.started_at >= start_dt)
        conversations = conversations.filter(Conversation.started_at <= end_dt)
        conversations = conversations.order_by(Conversation.created_at.desc()).all()
        level_history_query = db.query(UserLevelHistory).filter(UserLevelHistory.user_id == user_id)
        if start_dt is not None:
            level_history_query = level_history_query.filter(UserLevelHistory.created_at >= start_dt)
        level_history_query = level_history_query.filter(UserLevelHistory.created_at <= end_dt)
        if level:
            level_history_query = level_history_query.filter(UserLevelHistory.level == level)
        level_history = (
            level_history_query.order_by(UserLevelHistory.created_at.desc()).limit(8).all()
        )
        lessons_query = (
            db.query(PersonalizedLesson, Scenario.title)
            .outerjoin(Scenario, PersonalizedLesson.recommended_scenario_id == Scenario.id)
            .filter(
                PersonalizedLesson.user_id == user_id,
                PersonalizedLesson.status == "recommended",
            )
        )
        if start_dt is not None:
            lessons_query = lessons_query.filter(PersonalizedLesson.created_at >= start_dt)
        lessons_query = lessons_query.filter(PersonalizedLesson.created_at <= end_dt)
        lessons = lessons_query.order_by(PersonalizedLesson.created_at.desc()).limit(5).all()
        mistakes_query = db.query(MistakeMemory).filter(MistakeMemory.user_id == user_id)
        if start_dt is not None:
            mistakes_query = mistakes_query.filter(MistakeMemory.last_seen_at >= start_dt)
        mistakes_query = mistakes_query.filter(MistakeMemory.last_seen_at <= end_dt)
        if mistake_type:
            mistakes_query = mistakes_query.filter(MistakeMemory.mistake_type == mistake_type)
        mistakes = (
            mistakes_query.order_by(MistakeMemory.occurrence_count.desc(), MistakeMemory.updated_at.desc())
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
                    "scenario_id": conversation.scenario_id,
                    "language": conversation.language,
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
