from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.database.models.mistake_memory import MistakeMemory
from app.database.models.skill_metric import SkillMetric
from app.database.models.user_score import UserScore


class ReportService:
    def build_weekly_report(self, *, db: Session, user_id: int) -> dict:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=7)

        metrics = (
            db.query(SkillMetric)
            .filter(SkillMetric.user_id == user_id)
            .order_by(SkillMetric.metric_value.asc())
            .all()
        )
        weakest = metrics[0] if metrics else None
        strongest = metrics[-1] if metrics else None

        mistakes = (
            db.query(MistakeMemory)
            .filter(MistakeMemory.user_id == user_id)
            .filter(MistakeMemory.last_seen_at >= start)
            .order_by(MistakeMemory.occurrence_count.desc(), MistakeMemory.updated_at.desc())
            .limit(6)
            .all()
        )

        scores = (
            db.query(UserScore)
            .filter(UserScore.user_id == user_id)
            .filter(UserScore.created_at >= start)
            .order_by(UserScore.created_at.asc())
            .all()
        )

        trend: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for score in scores:
            label = score.created_at.strftime("%b %d")
            trend[score.score_type][label].append(float(score.score_value))

        improvement_trends = []
        for score_type, by_day in trend.items():
            points = [
                {"label": label, "value": round(sum(values) / len(values), 1)}
                for label, values in sorted(by_day.items(), key=lambda item: item[0])
            ]
            improvement_trends.append({"score_type": score_type, "points": points})

        next_week_goals: list[str] = []
        if weakest is not None:
            next_week_goals.append(
                f"Focus on {weakest.skill_name.replace('_', ' ')}: do 3 short practice answers and rescore them."
            )
        if mistakes:
            next_week_goals.append(
                f"Fix repeated mistake: {mistakes[0].mistake_type.replace('_', ' ')}. Review the hint before each session."
            )
        next_week_goals.append(
            "Record one 45-second answer with a clear structure: point, reason, example, conclusion."
        )

        return {
            "range_start": start.date().isoformat(),
            "range_end": now.date().isoformat(),
            "strongest_skill": {
                "skill_name": strongest.skill_name if strongest else None,
                "metric_value": float(strongest.metric_value) if strongest else 0.0,
            },
            "weakest_skill": {
                "skill_name": weakest.skill_name if weakest else None,
                "metric_value": float(weakest.metric_value) if weakest else 0.0,
            },
            "repeated_mistakes": [
                {
                    "mistake_type": item.mistake_type,
                    "mistake_key": item.mistake_key,
                    "hint": item.hint,
                    "correction": item.correction,
                    "occurrence_count": item.occurrence_count,
                    "last_seen_at": item.last_seen_at.isoformat() if item.last_seen_at else None,
                }
                for item in mistakes
            ],
            "weekly_trend": improvement_trends,
            "next_week_goals": next_week_goals[:4],
        }

    def build_timeline(self, *, db: Session, user_id: int, days: int = 14) -> dict:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=max(days, 1))

        scores = (
            db.query(UserScore)
            .filter(UserScore.user_id == user_id)
            .filter(UserScore.created_at >= start)
            .order_by(UserScore.score_type.asc(), UserScore.created_at.asc())
            .all()
        )

        by_type: dict[str, list[UserScore]] = defaultdict(list)
        for score in scores:
            by_type[score.score_type].append(score)

        events: list[dict] = []

        for score_type, items in by_type.items():
            previous: float | None = None
            for item in items:
                value = float(item.score_value)
                if previous is not None:
                    delta = value - previous
                    if delta <= -10:
                        events.append(
                            {
                                "type": "drop",
                                "category": "score",
                                "score_type": score_type,
                                "value": round(value, 1),
                                "delta": round(delta, 1),
                                "created_at": item.created_at.isoformat(),
                            }
                        )
                    elif delta >= 10:
                        events.append(
                            {
                                "type": "improvement",
                                "category": "score",
                                "score_type": score_type,
                                "value": round(value, 1),
                                "delta": round(delta, 1),
                                "created_at": item.created_at.isoformat(),
                            }
                        )
                previous = value

        mistakes = (
            db.query(MistakeMemory)
            .filter(MistakeMemory.user_id == user_id)
            .filter(MistakeMemory.last_seen_at >= start)
            .order_by(MistakeMemory.last_seen_at.desc())
            .limit(60)
            .all()
        )
        for mistake in mistakes:
            events.append(
                {
                    "type": "mistake",
                    "category": "mistake",
                    "mistake_type": mistake.mistake_type,
                    "mistake_key": mistake.mistake_key,
                    "occurrence_count": mistake.occurrence_count,
                    "hint": mistake.hint,
                    "correction": mistake.correction,
                    "created_at": mistake.last_seen_at.isoformat()
                    if mistake.last_seen_at
                    else None,
                }
            )

        # Sort newest first for a timeline feed.
        events.sort(key=lambda item: item.get("created_at") or "", reverse=True)

        return {
            "range_start": start.date().isoformat(),
            "range_end": now.date().isoformat(),
            "events": events[:120],
        }


report_service = ReportService()
