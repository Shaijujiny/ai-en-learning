from __future__ import annotations

import re
from collections import Counter


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
    "he",
    "her",
    "his",
    "i",
    "if",
    "in",
    "is",
    "it",
    "its",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "she",
    "so",
    "that",
    "the",
    "their",
    "them",
    "there",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
    "you",
    "your",
}

_FILLER_TOKENS = {"um", "uh", "er", "ah", "hmm"}
_FILLER_PHRASES = {"you know", "i mean", "kind of", "sort of", "maybe", "i think"}

_COMPLETENESS_MARKERS = {
    "because",
    "for example",
    "for instance",
    "so that",
    "as a result",
    "therefore",
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _round1(value: float) -> float:
    return round(float(value), 1)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _extract_words(transcript: str) -> list[str]:
    return _WORD_RE.findall(transcript or "")


def _extract_word_timestamps(payload: dict) -> list[dict]:
    words = payload.get("words")
    if isinstance(words, list) and words:
        return [w for w in words if isinstance(w, dict)]

    segments = payload.get("segments")
    if not isinstance(segments, list):
        return []

    extracted: list[dict] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        seg_words = segment.get("words")
        if isinstance(seg_words, list):
            extracted.extend([w for w in seg_words if isinstance(w, dict)])
    return extracted


def _extract_duration_seconds(payload: dict, word_timestamps: list[dict]) -> float | None:
    end_candidates: list[float] = []

    for item in word_timestamps:
        end = item.get("end")
        if isinstance(end, (int, float)):
            end_candidates.append(float(end))

    segments = payload.get("segments")
    if isinstance(segments, list):
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            end = segment.get("end")
            if isinstance(end, (int, float)):
                end_candidates.append(float(end))

    if not end_candidates:
        return None
    return max(end_candidates)


def _pause_stats(word_timestamps: list[dict]) -> dict:
    pairs: list[tuple[float, float]] = []
    for item in word_timestamps:
        start = item.get("start")
        end = item.get("end")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            pairs.append((float(start), float(end)))
    pairs.sort(key=lambda x: x[0])

    gaps: list[float] = []
    last_end: float | None = None
    for start, end in pairs:
        if last_end is not None and start >= last_end:
            gaps.append(start - last_end)
        last_end = max(last_end or 0.0, end)

    if not gaps:
        return {
            "pause_count": 0,
            "long_pause_count": 0,
            "silence_gap_count": 0,
            "avg_pause_sec": 0.0,
            "longest_pause_sec": 0.0,
        }

    pause_count = sum(1 for gap in gaps if gap >= 0.35)
    long_pause_count = sum(1 for gap in gaps if gap >= 0.9)
    silence_gap_count = sum(1 for gap in gaps if gap >= 1.6)
    avg_pause = sum(gaps) / len(gaps)
    longest = max(gaps)

    return {
        "pause_count": int(pause_count),
        "long_pause_count": int(long_pause_count),
        "silence_gap_count": int(silence_gap_count),
        "avg_pause_sec": float(avg_pause),
        "longest_pause_sec": float(longest),
    }


def _estimate_clarity_score(payload: dict) -> float:
    segments = payload.get("segments")
    if not isinstance(segments, list) or not segments:
        return 75.0

    logprobs: list[float] = []
    no_speech_probs: list[float] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        avg_logprob = segment.get("avg_logprob")
        if isinstance(avg_logprob, (int, float)):
            logprobs.append(float(avg_logprob))
        no_speech_prob = segment.get("no_speech_prob")
        if isinstance(no_speech_prob, (int, float)):
            no_speech_probs.append(float(no_speech_prob))

    base = 75.0

    if logprobs:
        mean_logprob = sum(logprobs) / len(logprobs)  # typically negative
        base = 40.0 + ((mean_logprob + 1.2) / 1.0) * 60.0

    if no_speech_probs:
        mean_no_speech = sum(no_speech_probs) / len(no_speech_probs)
        base -= mean_no_speech * 18.0

    return _clamp(_round1(base))


def _pace_score(words_per_minute: float | None) -> float:
    if not words_per_minute or words_per_minute <= 0:
        return 70.0

    # Roughly: 130-170 WPM is a comfortable target range for many learners.
    if 130 <= words_per_minute <= 170:
        return 92.0
    if 110 <= words_per_minute < 130 or 170 < words_per_minute <= 190:
        return 82.0
    if 90 <= words_per_minute < 110 or 190 < words_per_minute <= 215:
        return 70.0
    return 58.0


def _pause_score(stats: dict) -> float:
    pause_count = int(stats.get("pause_count", 0) or 0)
    long_pause_count = int(stats.get("long_pause_count", 0) or 0)
    silence_gap_count = int(stats.get("silence_gap_count", 0) or 0)

    score = 92.0
    score -= pause_count * 1.2
    score -= long_pause_count * 4.5
    score -= silence_gap_count * 7.5
    return _clamp(_round1(score))


def _filler_stats(transcript: str) -> dict:
    lowered = f" {transcript.lower()} "
    tokens = _WORD_RE.findall(lowered)
    token_counts = Counter(token.lower() for token in tokens)

    filler_token_count = sum(token_counts.get(t, 0) for t in _FILLER_TOKENS)
    phrase_hits: dict[str, int] = {}
    for phrase in _FILLER_PHRASES:
        count = lowered.count(f" {phrase} ")
        if count:
            phrase_hits[phrase] = count

    total = filler_token_count + sum(phrase_hits.values())
    examples = sorted(phrase_hits.keys())
    if filler_token_count:
        examples = ["um/uh"] + examples

    return {"count": int(total), "examples": examples[:4]}


def _filler_score(filler_count: int, *, word_count: int) -> float:
    if word_count <= 0:
        return 70.0
    rate = filler_count / max(word_count, 1)
    score = 94.0 - rate * 220.0
    return _clamp(_round1(score))


def _stress_targets(transcript: str) -> list[str]:
    words = [w.lower() for w in _extract_words(transcript)]
    content = [w for w in words if w not in _STOPWORDS and len(w) >= 4]
    counts = Counter(content)
    targets = [item for item, _ in counts.most_common(6)]
    return targets


def _completeness_score(transcript: str) -> float:
    text = _normalize_text(transcript).lower()
    if not text:
        return 40.0

    sentence_count = max(1, len(re.findall(r"[.!?]+", text)))
    word_count = len(_extract_words(text))
    marker_count = sum(1 for marker in _COMPLETENESS_MARKERS if marker in text)

    score = 62.0
    score += min(18.0, sentence_count * 4.0)
    score += min(12.0, marker_count * 6.0)
    score += 8.0 if word_count >= 45 else 0.0
    return _clamp(_round1(score))


def _repetition_stats(transcript: str) -> dict:
    words = [w.lower() for w in _extract_words(transcript)]
    if not words:
        return {"repetition_score": 75.0, "repeated_words": []}

    counts = Counter(words)
    repeated = [(w, c) for w, c in counts.items() if c >= 4 and w not in _STOPWORDS]
    repeated.sort(key=lambda x: (-x[1], x[0]))
    repeated_words = [w for w, _ in repeated[:6]]

    penalty = sum(max(0, c - 3) for _, c in repeated)
    score = 92.0 - penalty * 4.0
    return {"repetition_score": _clamp(_round1(score)), "repeated_words": repeated_words}


def build_intonation_coaching(transcript: str) -> dict:
    text = _normalize_text(transcript)
    lowered = text.lower()
    suggestions: list[str] = []

    if not text:
        return {"suggestions": ["Record a short answer so we can coach intonation."], "rhythm_markup": ""}

    questions = len(re.findall(r"\?", text))
    exclamations = len(re.findall(r"!", text))
    commas = len(re.findall(r",", text))

    if questions:
        suggestions.append(
            "Use a gentle rise at the end of real questions, then drop slightly after the key word."
        )
    else:
        suggestions.append("End statements with a clear fall to sound more certain.")

    if commas >= 2:
        suggestions.append(
            "For lists, keep a small rise on each item and a stronger fall on the last item."
        )

    if exclamations:
        suggestions.append("Avoid over-rising on excited words; keep the peak early, then relax.")

    if any(marker in lowered for marker in ("because", "but", "however", "although")):
        suggestions.append("Add a small pause before contrast words to make the rhythm clearer.")
    else:
        suggestions.append("Try one short pause between idea 1 and idea 2 to create natural rhythm.")

    targets = _stress_targets(text)
    if targets:
        suggestions.append(
            "Stress content words more than grammar words. Suggested stress targets: "
            + ", ".join(targets[:4])
            + "."
        )

    # Simple markup: slash between sentences as a pause cue.
    rhythm_markup = re.sub(r"\s*([.!?])\s*", r"\\1 / ", text).strip()
    return {"suggestions": suggestions[:5], "rhythm_markup": rhythm_markup[:400]}


class SpeakingService:
    def analyze(self, *, transcript: str, transcription_payload: dict) -> dict:
        transcript = _normalize_text(transcript)
        words = _extract_words(transcript)
        word_count = len(words)

        word_timestamps = _extract_word_timestamps(transcription_payload)
        duration_sec = _extract_duration_seconds(transcription_payload, word_timestamps)
        wpm = (word_count / (duration_sec / 60.0)) if duration_sec and duration_sec > 0 else None

        pause_stats = _pause_stats(word_timestamps)
        clarity_score = _estimate_clarity_score(transcription_payload)
        pace_score = _pace_score(wpm)
        pauses_score = _pause_score(pause_stats)

        filler = _filler_stats(transcript)
        filler_score = _filler_score(filler["count"], word_count=word_count)

        stress_targets = _stress_targets(transcript)
        stress_score = 78.0 if stress_targets else 70.0

        pronunciation_score = _clamp(
            _round1(
                clarity_score * 0.34
                + pace_score * 0.18
                + pauses_score * 0.28
                + filler_score * 0.12
                + stress_score * 0.08
            )
        )

        completeness = _completeness_score(transcript)
        repetition = _repetition_stats(transcript)
        confidence = 78.0
        confidence -= int(pause_stats.get("long_pause_count", 0)) * 6.0
        confidence -= int(pause_stats.get("silence_gap_count", 0)) * 10.0
        confidence -= max(0.0, 72.0 - completeness) * 0.22
        confidence -= max(0.0, 88.0 - repetition["repetition_score"]) * 0.25
        confidence -= 8.0 if word_count < 25 else 0.0
        confidence += 6.0 if word_count >= 70 else 0.0
        confidence_score = _clamp(_round1(confidence))

        intonation = build_intonation_coaching(transcript)

        return {
            "transcript": transcript,
            "pronunciation": {
                "overall_score": pronunciation_score,
                "clarity": {"score": clarity_score},
                "pace": {
                    "wpm": _round1(wpm) if wpm else None,
                    "score": _round1(pace_score),
                },
                "pauses": {
                    **pause_stats,
                    "avg_pause_sec": _round1(pause_stats.get("avg_pause_sec", 0.0)),
                    "longest_pause_sec": _round1(
                        pause_stats.get("longest_pause_sec", 0.0)
                    ),
                    "score": pauses_score,
                },
                "filler_words": {
                    "count": filler["count"],
                    "examples": filler["examples"],
                    "score": filler_score,
                },
                "stress_patterns": {
                    "score": _round1(stress_score),
                    "targets": stress_targets,
                },
            },
            "intonation": intonation,
            "confidence": {
                "overall_score": confidence_score,
                "hesitation": {
                    "long_pause_count": pause_stats["long_pause_count"],
                    "silence_gap_count": pause_stats["silence_gap_count"],
                },
                "repetition": repetition,
                "short_answer": {"word_count": word_count, "is_short": word_count < 25},
                "completeness": {"score": completeness},
            },
            "meta": {
                "duration_sec": _round1(duration_sec) if duration_sec else None,
                "word_count": word_count,
                "has_timestamps": bool(word_timestamps),
            },
        }


speaking_service = SpeakingService()

