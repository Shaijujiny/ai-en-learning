from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.ai_client import AIClient
from app.core.fluency_service import fluency_service
from app.core.grammar_service import grammar_service
from app.core.logging import ai_logger
from app.core.vocabulary_service import vocabulary_service
from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.user import User


_WORD_RE = re.compile(r"[a-zA-Z']+")
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "i",
    "if",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "to",
    "was",
    "we",
    "were",
    "with",
    "you",
    "your",
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _round1(value: float) -> float:
    return round(float(value), 1)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _extract_keywords(text: str) -> set[str]:
    tokens = [t.lower() for t in _WORD_RE.findall(text or "")]
    return {t for t in tokens if t not in _STOPWORDS and len(t) >= 4}


def _sentence_count(text: str) -> int:
    return max(1, len(re.findall(r"[.!?]+", text or "")))


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text or ""))


def _confidence_score(text: str) -> float:
    lowered = f" {text.lower()} "
    filler_penalty = sum(lowered.count(token) for token in (" um ", " uh ", " maybe ", " i think "))
    words = _WORD_RE.findall(text or "")
    long_answer_bonus = 10 if len(words) >= 80 else 5 if len(words) >= 50 else 0
    score = 72 + long_answer_bonus - (filler_penalty * 6)
    return _round1(_clamp(score, 25, 100))


def _completeness_score(text: str) -> float:
    words = _word_count(text)
    sentences = _sentence_count(text)
    # Mirrors the onboarding heuristic but for a single answer.
    sentence_score = min(sentences * 18, 55)
    word_score = min(words * 1.1, 45)
    return _round1(_clamp(sentence_score + word_score))


def _structure_score(text: str) -> float:
    lowered = text.lower()
    markers = sum(
        1
        for marker in (
            "first",
            "second",
            "third",
            "finally",
            "for example",
            "because",
            "as a result",
            "therefore",
            "however",
        )
        if marker in lowered
    )
    sentences = _sentence_count(text)
    words = _word_count(text)
    score = 58 + min(18, sentences * 6) + min(18, markers * 6) + (6 if words >= 45 else 0)
    return _round1(_clamp(score))


def _clarity_score(text: str, *, grammar_match_count: int) -> float:
    sentences = _sentence_count(text)
    words = _word_count(text)
    avg_words = words / max(sentences, 1)
    penalty = abs(avg_words - 16) * 1.2
    score = 84 - penalty - (grammar_match_count * 2.2)
    return _round1(_clamp(score))


def _relevance_score(answer: str, question: str | None) -> float:
    if not question:
        return 75.0
    q = _extract_keywords(question)
    a = _extract_keywords(answer)
    if not q:
        return 75.0
    overlap = len(q.intersection(a))
    ratio = overlap / max(len(q), 1)
    return _round1(_clamp(60 + ratio * 40))


@dataclass(frozen=True)
class RubricResult:
    overall_score: float
    scores: dict[str, float]
    action_items: list[str]
    notes: dict[str, str]


class FeedbackService:
    def __init__(self) -> None:
        self._ai = AIClient()

    @property
    def ai_available(self) -> bool:
        return self._ai.available

    def resolve_message_text(
        self,
        *,
        db: Session,
        current_user: User,
        message_id: int | None,
        text: str | None,
    ) -> tuple[str, int | None]:
        resolved_text = _normalize(text or "")
        resolved_conversation_id: int | None = None

        if message_id is not None:
            message = (
                db.query(Message)
                .join(Conversation, Message.conversation_id == Conversation.id)
                .filter(Message.id == message_id)
                .filter(Conversation.user_id == current_user.id)
                .first()
            )
            if message is None:
                raise ValueError("Message not found.")
            resolved_text = message.content
            resolved_conversation_id = message.conversation_id

        if not resolved_text:
            raise ValueError("Text is required.")

        return resolved_text, resolved_conversation_id

    def resolve_last_prompt(
        self,
        *,
        db: Session,
        current_user: User,
        conversation_id: int | None,
    ) -> str | None:
        if conversation_id is None:
            return None

        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id)
            .filter(Conversation.user_id == current_user.id)
            .first()
        )
        if conversation is None:
            return None

        last_assistant = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id, Message.sender_role == "assistant")
            .order_by(Message.id.desc())
            .first()
        )
        return last_assistant.content if last_assistant else None

    def score_rubric(
        self,
        *,
        text: str,
        question: str | None,
    ) -> RubricResult:
        grammar_result = grammar_service.safe_analyze_text(text)
        grammar_match_count = len(grammar_result.get("matches", [])) if grammar_result else 0
        fluency_result = fluency_service.analyze(text=text, grammar_match_count=grammar_match_count)
        vocabulary_result = vocabulary_service.analyze(text)

        grammar_score = _round1(_clamp(92 - grammar_match_count * 4.0))
        vocabulary_score = _round1(_clamp(float(vocabulary_result["overall_score"])))
        confidence_score = _confidence_score(text)
        completeness_score = _completeness_score(text)
        structure_score = _structure_score(text)
        clarity_score = _clarity_score(text, grammar_match_count=grammar_match_count)
        relevance_score = _relevance_score(text, question)

        scores = {
            "relevance": relevance_score,
            "structure": structure_score,
            "clarity": clarity_score,
            "grammar": grammar_score,
            "vocabulary": vocabulary_score,
            "confidence": confidence_score,
            "completeness": completeness_score,
        }
        overall = _round1(sum(scores.values()) / len(scores))

        weakest = sorted(scores.items(), key=lambda item: item[1])[:2]
        suggestions_map = {
            "relevance": "Answer the exact question first, then add one supporting detail.",
            "structure": "Use a simple structure: main point, reason, example, wrap-up.",
            "clarity": "Prefer shorter sentences and reduce unnecessary extra clauses.",
            "grammar": "Slow down and check tense + subject-verb agreement once before sending.",
            "vocabulary": "Swap 2 common words for more precise ones (specific verbs and nouns).",
            "confidence": "Remove hedges like 'maybe' and end with a clear concluding sentence.",
            "completeness": "Add one concrete example and one result to fully finish the answer.",
        }
        action_items = [suggestions_map.get(key, f"Improve {key}.") for key, _ in weakest]

        notes = {
            "grammar_match_count": str(grammar_match_count),
            "fluency_summary": str(fluency_result.get("summary", "")),
            "vocabulary_summary": str(vocabulary_result.get("summary", "")),
        }
        return RubricResult(
            overall_score=overall,
            scores=scores,
            action_items=action_items,
            notes=notes,
        )

    def rewrite(
        self,
        *,
        text: str,
        mode: str,
    ) -> dict:
        normalized = _normalize(text)
        mode_key = (mode or "").strip().lower()
        if not normalized:
            return {"mode": mode_key, "rewritten_text": "", "notes": ["No text to rewrite."]}

        if not self._ai.available:
            return {
                "mode": mode_key,
                "rewritten_text": "",
                "notes": [
                    f"Rewrite is unavailable. AI_PROVIDER='{self._ai.provider}' "
                    f"but the corresponding API key is not configured."
                ],
            }

        instruction = {
            "make natural": "Rewrite to sound natural and conversational in English.",
            "make professional": "Rewrite to sound professional and workplace-appropriate.",
            "make advanced": "Rewrite using richer vocabulary and more complex but natural structures.",
            "make shorter": "Rewrite to be shorter while keeping the key meaning.",
            "make interview-ready": "Rewrite as an interview-ready answer with clear structure and confident tone.",
        }.get(mode_key, "Rewrite to improve the answer while keeping the meaning.")

        rewritten = self._ai.create_message(
            system=(
                "You are an English coach. Return only the rewritten answer text. "
                "Do not add extra commentary. Do not add new facts."
            ),
            messages=[{"role": "user", "content": f"{instruction}\n\nAnswer:\n{normalized}"}],
        )
        ai_logger.info("answer_rewrite_generated provider=%s mode=%s", self._ai.provider, mode_key)
        return {"mode": mode_key, "rewritten_text": rewritten, "notes": []}


feedback_service = FeedbackService()
