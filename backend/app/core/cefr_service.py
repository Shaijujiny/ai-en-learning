from __future__ import annotations

from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.models.user_level_history import UserLevelHistory


class CEFRService:
    LEVEL_THRESHOLDS = [
        (85, "C2"),
        (75, "C1"),
        (65, "B2"),
        (50, "B1"),
        (35, "A2"),
        (0, "A1"),
    ]

    def estimate_level(self, overall_score: float) -> str:
        for threshold, level in self.LEVEL_THRESHOLDS:
            if overall_score >= threshold:
                return level
        return "A1"

    def estimate_confidence_score(
        self,
        *,
        overall_score: float,
        skill_breakdown: dict[str, float],
        sample_count: int,
    ) -> float:
        if not skill_breakdown:
            return 40.0

        spread = max(skill_breakdown.values()) - min(skill_breakdown.values())
        consistency_bonus = max(18 - (spread / 4), 0)
        sample_bonus = min(sample_count * 4, 20)
        confidence = min(55 + (overall_score / 5) + consistency_bonus + sample_bonus, 98)
        return round(confidence, 1)

    def update_user_level(
        self,
        *,
        db: Session,
        user: User,
        overall_score: float,
        skill_breakdown: dict[str, float],
        source: str,
        sample_count: int = 1,
    ) -> dict[str, str | float]:
        level = self.estimate_level(overall_score)
        confidence_score = self.estimate_confidence_score(
            overall_score=overall_score,
            skill_breakdown=skill_breakdown,
            sample_count=sample_count,
        )

        user.user_level = level
        if skill_breakdown:
            current_breakdown = user.skill_breakdown or {}
            merged_breakdown = {**current_breakdown}
            for key, value in skill_breakdown.items():
                previous = float(current_breakdown.get(key, value))
                merged_breakdown[key] = round((previous + value) / 2, 1)
            user.skill_breakdown = merged_breakdown

        history = UserLevelHistory(
            user_id=user.id,
            level=level,
            confidence_score=confidence_score,
            source=source,
        )
        db.add(history)
        db.flush()
        return {
            "current_level": level,
            "confidence_score": confidence_score,
        }


cefr_service = CEFRService()
