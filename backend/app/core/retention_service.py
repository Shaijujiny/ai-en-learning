from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.user import User
from app.database.models.user_score import UserScore
from app.database.models.vocabulary_review_item import VocabularyReviewItem
from app.database.models.vocabulary_review_session import VocabularyReviewSession


def _daterange_set(dates: list[date]) -> set[date]:
    return {d for d in dates if isinstance(d, date)}


class RetentionService:
    DEFAULT_GOALS = {
        "weekly_lesson_target": 5,
        "weekly_vocabulary_items": 10,
        "weekly_fluency_target": 75.0,
        "weekly_interview_readiness_target": 75.0,
    }

    def compute_daily_streak(self, *, active_days: set[date], today: date) -> int:
        streak = 0
        cursor = today
        while cursor in active_days:
            streak += 1
            cursor = cursor - timedelta(days=1)
        return streak

    def build_summary(self, *, db: Session, user: User) -> dict:
        now = datetime.now(timezone.utc)
        today = now.date()
        week_start = today - timedelta(days=6)
        start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)

        # Activity days: user messages or scores count as engagement.
        message_days = (
            db.query(func.date(Message.created_at))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .filter(Conversation.user_id == user.id)
            .filter(Message.sender_role == "user")
            .filter(Message.created_at >= start_dt - timedelta(days=60))
            .all()
        )
        score_days = (
            db.query(func.date(UserScore.created_at))
            .filter(UserScore.user_id == user.id)
            .filter(UserScore.created_at >= start_dt - timedelta(days=60))
            .all()
        )
        active_days = _daterange_set([row[0] for row in message_days] + [row[0] for row in score_days])
        daily_streak = self.compute_daily_streak(active_days=active_days, today=today)

        goals = dict(self.DEFAULT_GOALS)
        if isinstance(user.goals, dict):
            goals.update({k: user.goals.get(k, v) for k, v in self.DEFAULT_GOALS.items()})

        # Weekly lesson progress: count days with at least one activity as a proxy.
        weekly_active_days = [d for d in active_days if week_start <= d <= today]
        weekly_lesson_progress = len(set(weekly_active_days))

        # Vocabulary progress: review items in the last 7 days.
        vocabulary_items = (
            db.query(VocabularyReviewItem)
            .join(VocabularyReviewSession, VocabularyReviewItem.session_id == VocabularyReviewSession.id)
            .filter(VocabularyReviewSession.user_id == user.id)
            .filter(VocabularyReviewItem.created_at >= start_dt)
            .count()
        )

        # Fluency and interview readiness from recent scores (if present).
        fluency_scores = (
            db.query(UserScore)
            .filter(UserScore.user_id == user.id)
            .filter(UserScore.score_type == "fluency")
            .filter(UserScore.created_at >= start_dt)
            .order_by(UserScore.created_at.desc())
            .limit(12)
            .all()
        )
        fluency_avg = (
            round(sum(float(item.score_value) for item in fluency_scores) / len(fluency_scores), 1)
            if fluency_scores
            else 0.0
        )
        readiness_scores = (
            db.query(UserScore)
            .filter(UserScore.user_id == user.id)
            .filter(UserScore.score_type == "answer_quality_overall")
            .filter(UserScore.created_at >= start_dt)
            .order_by(UserScore.created_at.desc())
            .limit(12)
            .all()
        )
        readiness_avg = (
            round(sum(float(item.score_value) for item in readiness_scores) / len(readiness_scores), 1)
            if readiness_scores
            else 0.0
        )

        return {
            "today": today.isoformat(),
            "daily_streak": daily_streak,
            "active_today": today in active_days,
            "weekly_range_start": week_start.isoformat(),
            "weekly_range_end": today.isoformat(),
            "goals": goals,
            "progress": {
                "weekly_lesson_days": weekly_lesson_progress,
                "weekly_vocabulary_items": vocabulary_items,
                "weekly_fluency_average": fluency_avg,
                "weekly_interview_readiness_average": readiness_avg,
            },
        }

    def update_goals(self, *, db: Session, user: User, goals: dict) -> dict:
        merged = dict(self.DEFAULT_GOALS)
        if isinstance(user.goals, dict):
            merged.update(user.goals)
        for key in self.DEFAULT_GOALS.keys():
            if key in goals:
                merged[key] = goals[key]
        user.goals = merged
        db.commit()
        return {"goals": merged}


retention_service = RetentionService()
