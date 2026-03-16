from collections import defaultdict

from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.scenario import Scenario
from app.database.models.skill_metric import SkillMetric
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
            "conversation_history": history_items,
        }


analytics_service = AnalyticsService()
