from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.database.models.user_daily_progress import UserDailyProgress
from app.database.models.user_xp import UserXP

# XP awarded per task
TASK_XP: dict[str, int] = {
    "conversation": 50,
    "vocabulary": 20,
    "speaking": 30,
    "review": 15,
}

VALID_TASKS = set(TASK_XP.keys())

# Level thresholds: (min_xp, level, title, icon)
LEVELS = [
    (0,    1,  "Beginner",     "🌱"),
    (200,  2,  "Learner",      "📖"),
    (400,  3,  "Speaker",      "💬"),
    (600,  4,  "Communicator", "🗣️"),
    (800,  5,  "Conversant",   "✨"),
    (1000, 6,  "Fluent",       "🌊"),
    (1400, 7,  "Expert",       "🎯"),
    (1800, 8,  "Master",       "🏆"),
    (2400, 9,  "Elite",        "💎"),
    (3000, 10, "Champion",     "👑"),
]


def _get_level(total_xp: int) -> dict:
    current = LEVELS[0]
    for entry in LEVELS:
        if total_xp >= entry[0]:
            current = entry
    idx = LEVELS.index(current)
    nxt = LEVELS[idx + 1] if idx + 1 < len(LEVELS) else None
    progress = (
        int((total_xp - current[0]) / (nxt[0] - current[0]) * 100)
        if nxt
        else 100
    )
    return {
        "level": current[1],
        "title": current[2],
        "icon": current[3],
        "min_xp": current[0],
        "next_level": nxt[1] if nxt else None,
        "next_min_xp": nxt[0] if nxt else None,
        "xp_to_next": (nxt[0] - total_xp) if nxt else 0,
        "progress_pct": progress,
    }


class DailyService:
    def _get_or_create_xp(self, db: Session, *, user_id: int) -> UserXP:
        xp = db.query(UserXP).filter(UserXP.user_id == user_id).first()
        if xp is None:
            xp = UserXP(user_id=user_id)
            db.add(xp)
            db.flush()
        return xp

    def _get_or_create_progress(self, db: Session, *, user_id: int, today: date) -> UserDailyProgress:
        progress = (
            db.query(UserDailyProgress)
            .filter(UserDailyProgress.user_id == user_id, UserDailyProgress.plan_date == today)
            .first()
        )
        if progress is None:
            progress = UserDailyProgress(user_id=user_id, plan_date=today)
            db.add(progress)
            db.flush()
        return progress

    def _update_streak(self, xp: UserXP, today: date) -> None:
        if xp.last_active_date is None:
            xp.current_streak = 1
        elif xp.last_active_date == today:
            pass  # Already counted today
        else:
            days_diff = (today - xp.last_active_date).days
            if days_diff == 1:
                xp.current_streak += 1
            else:
                xp.current_streak = 1
        xp.last_active_date = today
        if xp.current_streak > xp.longest_streak:
            xp.longest_streak = xp.current_streak

    def get_status(self, db: Session, *, user_id: int) -> dict:
        today = datetime.now(tz=timezone.utc).date()
        xp = self._get_or_create_xp(db, user_id=user_id)
        progress = self._get_or_create_progress(db, user_id=user_id, today=today)
        db.commit()

        completed_tasks = [
            task for task in VALID_TASKS
            if getattr(progress, f"{task}_done", False)
        ]
        daily_xp = sum(TASK_XP[t] for t in completed_tasks)

        return {
            "today": today.isoformat(),
            "total_xp": xp.total_xp,
            "current_streak": xp.current_streak,
            "longest_streak": xp.longest_streak,
            "last_active_date": xp.last_active_date.isoformat() if xp.last_active_date else None,
            "level_info": _get_level(xp.total_xp),
            "tasks": {
                "conversation": progress.conversation_done,
                "vocabulary": progress.vocabulary_done,
                "speaking": progress.speaking_done,
                "review": progress.review_done,
            },
            "completed_count": len(completed_tasks),
            "total_tasks": len(VALID_TASKS),
            "daily_xp_earned": daily_xp,
            "daily_xp_possible": sum(TASK_XP.values()),
        }

    def complete_task(self, db: Session, *, user_id: int, task_id: str) -> dict:
        if task_id not in VALID_TASKS:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown task '{task_id}'. Valid: {sorted(VALID_TASKS)}",
            )

        today = datetime.now(tz=timezone.utc).date()
        xp = self._get_or_create_xp(db, user_id=user_id)
        progress = self._get_or_create_progress(db, user_id=user_id, today=today)

        field = f"{task_id}_done"
        already_done = getattr(progress, field, False)

        awarded_xp = 0
        leveled_up = False

        if not already_done:
            setattr(progress, field, True)
            awarded_xp = TASK_XP[task_id]
            progress.xp_earned += awarded_xp

            prev_level = _get_level(xp.total_xp)["level"]
            xp.total_xp += awarded_xp
            new_level = _get_level(xp.total_xp)["level"]
            leveled_up = new_level > prev_level

            self._update_streak(xp, today)

        db.commit()

        return {
            "task_id": task_id,
            "already_done": already_done,
            "awarded_xp": awarded_xp,
            "leveled_up": leveled_up,
            "total_xp": xp.total_xp,
            "current_streak": xp.current_streak,
            "level_info": _get_level(xp.total_xp),
        }


daily_service = DailyService()
