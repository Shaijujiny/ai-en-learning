from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import re

from sqlalchemy.orm import Session

from app.database.models.mistake_memory import MistakeMemory
from app.database.models.user import User


class MistakeMemoryService:
    WORD_PATTERN = re.compile(r"\b[a-zA-Z']+\b")
    PREPOSITIONS = {"in", "on", "at", "for", "to", "with", "by", "from", "about"}
    ARTICLES = {"a", "an", "the"}

    def record_grammar_matches(
        self,
        *,
        db: Session,
        user: User,
        text: str,
        matches: list[dict],
    ) -> list[MistakeMemory]:
        recorded: list[MistakeMemory] = []
        for match in matches:
            rule_id = match.get("rule", {}).get("id", "unknown")
            message = match.get("message", "Grammar issue")
            category = match.get("rule", {}).get("category", {}).get("name", "grammar")
            mistake_type = self.classify_rule(rule_id=rule_id, category=category)
            correction = None
            replacements = match.get("replacements", [])
            if replacements:
                correction = replacements[0].get("value")
            recorded.append(
                self.upsert_mistake(
                    db=db,
                    user=user,
                    mistake_type=mistake_type,
                    mistake_key=rule_id,
                    example_text=text[:500],
                    correction=correction,
                    hint=message,
                )
            )
        return recorded

    def record_repeated_words(
        self,
        *,
        db: Session,
        user: User,
        text: str,
    ) -> list[MistakeMemory]:
        words = [word.lower() for word in self.WORD_PATTERN.findall(text)]
        repeated = [word for word, count in Counter(words).items() if count >= 4 and len(word) > 3]
        recorded: list[MistakeMemory] = []
        for word in repeated[:5]:
            recorded.append(
                self.upsert_mistake(
                    db=db,
                    user=user,
                    mistake_type="repeated_weak_words",
                    mistake_key=word,
                    example_text=text[:500],
                    correction=None,
                    hint=f"The word '{word}' was repeated often. Try using more variety.",
                )
            )
        return recorded

    def top_mistakes(self, *, db: Session, user_id: int, limit: int = 5) -> list[MistakeMemory]:
        return (
            db.query(MistakeMemory)
            .filter(MistakeMemory.user_id == user_id)
            .order_by(MistakeMemory.occurrence_count.desc(), MistakeMemory.updated_at.desc())
            .limit(limit)
            .all()
        )

    def upsert_mistake(
        self,
        *,
        db: Session,
        user: User,
        mistake_type: str,
        mistake_key: str,
        example_text: str,
        correction: str | None,
        hint: str | None,
    ) -> MistakeMemory:
        record = (
            db.query(MistakeMemory)
            .filter(
                MistakeMemory.user_id == user.id,
                MistakeMemory.mistake_type == mistake_type,
                MistakeMemory.mistake_key == mistake_key,
            )
            .first()
        )
        if record is None:
            record = MistakeMemory(
                user_id=user.id,
                mistake_type=mistake_type,
                mistake_key=mistake_key,
                example_text=example_text,
                correction=correction,
                hint=hint,
                occurrence_count=1,
                last_seen_at=datetime.now(timezone.utc),
            )
            db.add(record)
            db.flush()
            return record

        record.example_text = example_text
        record.correction = correction or record.correction
        record.hint = hint or record.hint
        record.occurrence_count += 1
        record.last_seen_at = datetime.now(timezone.utc)
        db.flush()
        return record

    def classify_rule(self, *, rule_id: str, category: str) -> str:
        lowered_rule = rule_id.lower()
        lowered_category = category.lower()
        if "tense" in lowered_rule or "tense" in lowered_category:
            return "tense"
        if "article" in lowered_rule or "article" in lowered_category or "determiner" in lowered_category:
            return "article"
        if "prep" in lowered_rule or "preposition" in lowered_category:
            return "preposition"
        if "style" in lowered_category or "word order" in lowered_category:
            return "sentence_structure"
        return "sentence_structure"


mistake_memory_service = MistakeMemoryService()
