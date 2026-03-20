import hashlib
import json
import time
from collections.abc import Iterator, Sequence

from app.core.ai_client import AIClient
from app.core.cache import cache_service
from app.core.config import settings
from app.core.logging import ai_logger
from app.database.models.conversation import ConversationLanguage
from app.features.ai_chat.prompt_builder import build_system_prompt


class AIChatService:
    def __init__(self) -> None:
        self._ai = AIClient()

    def generate_reply(
        self,
        *,
        system_prompt: str,
        scenario_title: str,
        scenario_description: str,
        scenario_difficulty: str,
        target_language: ConversationLanguage | str,
        conversation_history: Sequence[dict[str, str]],
        current_level: str | None,
        skill_breakdown: dict[str, float],
        correction_mode: str,
        mistake_memory: Sequence[dict[str, str | None]],
    ) -> str:
        started_at = time.perf_counter()
        prompt = build_system_prompt(
            system_prompt=system_prompt,
            scenario_title=scenario_title,
            scenario_description=scenario_description,
            scenario_difficulty=scenario_difficulty,
            target_language=target_language,
            conversation_history=conversation_history,
            current_level=current_level,
            skill_breakdown=skill_breakdown,
            correction_mode=correction_mode,
            mistake_memory=mistake_memory,
        )
        cache_key = cache_service.make_key(
            "ai-response",
            hashlib.sha256(
                json.dumps(
                    {
                        "scenario_title": scenario_title,
                        "correction_mode": correction_mode,
                        "history": list(conversation_history),
                    },
                    sort_keys=True,
                ).encode()
            ).hexdigest(),
        )
        cached_reply = cache_service.get_string(cache_key)
        if cached_reply is not None:
            ai_logger.info(
                "ai_reply_cache_hit scenario=%s latency_ms=%.2f history_count=%s",
                scenario_title,
                (time.perf_counter() - started_at) * 1000,
                len(conversation_history),
            )
            return cached_reply

        if not self._ai.available:
            content = (
                f"AI is not available. AI_PROVIDER is set to '{self._ai.provider}' "
                f"but the corresponding API key is not configured."
            )
            ai_logger.warning(
                "ai_reply_skipped reason=no_api_key scenario=%s provider=%s",
                scenario_title,
                self._ai.provider,
            )
            cache_service.set_string(cache_key, content, settings.redis_ai_cache_ttl_seconds)
            return content

        content = self._ai.create_message(
            system=prompt,
            messages=list(conversation_history),
        )
        ai_logger.info(
            "ai_reply_generated provider=%s scenario=%s latency_ms=%.2f history_count=%s",
            self._ai.provider,
            scenario_title,
            (time.perf_counter() - started_at) * 1000,
            len(conversation_history),
        )
        cache_service.set_string(cache_key, content, settings.redis_ai_cache_ttl_seconds)
        return content

    def generate_reply_stream(
        self,
        *,
        system_prompt: str,
        scenario_title: str,
        scenario_description: str,
        scenario_difficulty: str,
        target_language: ConversationLanguage | str,
        conversation_history: Sequence[dict[str, str]],
        current_level: str | None,
        skill_breakdown: dict[str, float],
        correction_mode: str,
        mistake_memory: Sequence[dict[str, str | None]],
    ) -> Iterator[str]:
        prompt = build_system_prompt(
            system_prompt=system_prompt,
            scenario_title=scenario_title,
            scenario_description=scenario_description,
            scenario_difficulty=scenario_difficulty,
            target_language=target_language,
            conversation_history=conversation_history,
            current_level=current_level,
            skill_breakdown=skill_breakdown,
            correction_mode=correction_mode,
            mistake_memory=mistake_memory,
        )
        if not self._ai.available:
            yield (
                f"AI is not available. AI_PROVIDER is set to '{self._ai.provider}' "
                f"but the corresponding API key is not configured."
            )
            return
        yield from self._ai.stream_message(
            system=prompt,
            messages=list(conversation_history),
        )


ai_chat_service = AIChatService()
