"""
Personalization engine — recommends scenarios based on:
  • User's CEFR level  → matches scenario difficulty
  • Top mistake types  → maps to scenario keywords
  • Weakest skill area → boosts scenarios that target it
"""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models.mistake_memory import MistakeMemory
from app.database.models.scenario import Scenario
from app.database.models.user import User
from app.database.models.user_score import UserScore

# ── Level → difficulty mapping ────────────────────────────────────────────────
_LEVEL_TO_DIFFICULTY: dict[str, str] = {
    "A1": "Beginner",
    "A2": "Beginner",
    "B1": "Intermediate",
    "B2": "Intermediate",
    "C1": "Advanced",
    "C2": "Advanced",
}

# ── Mistake type → scenario title keywords ────────────────────────────────────
_MISTAKE_KEYWORDS: dict[str, list[str]] = {
    "grammar": ["interview", "business", "presentation", "academic"],
    "vocabulary": ["interview", "business", "shopping", "travel"],
    "tense": ["storytelling", "presentation", "meeting"],
    "preposition": ["travel", "directions", "restaurant"],
    "article": ["academic", "presentation", "business"],
    "pronunciation": ["presentation", "speaking", "business"],
    "word_choice": ["interview", "negotiation", "business"],
    "fluency": ["casual", "conversation", "everyday"],
    "sentence_structure": ["academic", "presentation", "interview"],
}

# ── Weak score type → scenario keywords ──────────────────────────────────────
_SCORE_KEYWORDS: dict[str, list[str]] = {
    "fluency": ["casual conversation", "everyday", "small talk"],
    "grammar": ["business", "interview", "formal"],
    "interview_readiness": ["job interview", "interview", "business meeting"],
    "pronunciation": ["presentation", "public speaking", "business"],
    "answer_quality_overall": ["interview", "presentation", "academic"],
    "vocabulary": ["business", "travel", "shopping"],
}

# ── Difficulty tag shown to user ──────────────────────────────────────────────
_REASON_TEMPLATES = {
    "level_match": "Matches your {level} level",
    "mistake": "Targets your {mistake_type} mistakes",
    "weak_score": "Builds your weakest area: {score_type}",
    "popular": "Great all-round practice",
}


class PersonalizationService:

    @staticmethod
    def _difficulty_str(scenario: "Scenario") -> str:
        """Return the difficulty as a plain string, whether it's an Enum or already a str."""
        d = scenario.difficulty
        return d.value if hasattr(d, "value") else str(d)

    def _user_difficulty(self, user: User) -> str | None:
        level = (user.user_level or "").upper()
        return _LEVEL_TO_DIFFICULTY.get(level)

    def _top_mistakes(self, db: Session, *, user_id: int, limit: int = 3) -> list[str]:
        rows = (
            db.query(MistakeMemory.mistake_type, func.sum(MistakeMemory.occurrence_count).label("cnt"))
            .filter(MistakeMemory.user_id == user_id)
            .group_by(MistakeMemory.mistake_type)
            .order_by(func.sum(MistakeMemory.occurrence_count).desc())
            .limit(limit)
            .all()
        )
        return [str(r.mistake_type) for r in rows]

    def _weak_score_type(self, db: Session, *, user_id: int) -> str | None:
        """Return the score_type with the lowest average over last 30 days."""
        from datetime import datetime, timedelta, timezone

        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=30)
        rows = (
            db.query(
                UserScore.score_type,
                func.avg(UserScore.score_value).label("avg_score"),
            )
            .filter(UserScore.user_id == user_id, UserScore.created_at >= cutoff)
            .group_by(UserScore.score_type)
            .order_by(func.avg(UserScore.score_value))
            .limit(1)
            .first()
        )
        return str(rows.score_type) if rows else None

    def _score_scenario(
        self,
        scenario: Scenario,
        *,
        preferred_difficulty: str | None,
        top_mistakes: list[str],
        weak_score_type: str | None,
    ) -> tuple[float, list[str]]:
        title_lower = scenario.title.lower()
        score = 0.0
        reasons: list[str] = []

        # Level match
        if preferred_difficulty and self._difficulty_str(scenario) == preferred_difficulty:
            score += 4.0
            reasons.append(_REASON_TEMPLATES["level_match"].format(level=preferred_difficulty))

        # Mistake type match
        for mistake in top_mistakes:
            kws = _MISTAKE_KEYWORDS.get(mistake, [])
            if any(kw in title_lower for kw in kws):
                score += 3.0
                reasons.append(
                    _REASON_TEMPLATES["mistake"].format(
                        mistake_type=mistake.replace("_", " ")
                    )
                )
                break  # one reason per scenario is enough

        # Weak score match
        if weak_score_type:
            kws = _SCORE_KEYWORDS.get(weak_score_type, [])
            if any(kw in title_lower for kw in kws):
                score += 2.0
                reasons.append(
                    _REASON_TEMPLATES["weak_score"].format(
                        score_type=weak_score_type.replace("_", " ")
                    )
                )

        if not reasons:
            score += 0.5
            reasons.append(_REASON_TEMPLATES["popular"])

        return score, reasons[:1]  # Surface the most relevant reason only

    def get_recommendations(
        self,
        db: Session,
        *,
        user: User,
        limit: int = 5,
    ) -> dict:
        preferred_difficulty = self._user_difficulty(user)
        top_mistakes = self._top_mistakes(db, user_id=user.id)
        weak_score_type = self._weak_score_type(db, user_id=user.id)

        scenarios = db.query(Scenario).order_by(Scenario.id).all()

        scored = []
        for scenario in scenarios:
            score, reasons = self._score_scenario(
                scenario,
                preferred_difficulty=preferred_difficulty,
                top_mistakes=top_mistakes,
                weak_score_type=weak_score_type,
            )
            scored.append((score, scenario, reasons))

        scored.sort(key=lambda x: -x[0])
        top = scored[:limit]

        return {
            "user_level": user.user_level,
            "preferred_difficulty": preferred_difficulty,
            "focus_areas": top_mistakes,
            "weak_score_type": weak_score_type,
            "recommendations": [
                {
                    "scenario_id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "difficulty": self._difficulty_str(s),
                    "reason": reasons[0] if reasons else "Great practice",
                    "relevance_score": round(sc, 1),
                }
                for sc, s, reasons in top
            ],
        }


personalization_service = PersonalizationService()
