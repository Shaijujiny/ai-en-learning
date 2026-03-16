import json
import time
from collections.abc import Sequence

from openai import OpenAI

from app.core.cache import cache_service
from app.core.config import settings
from app.core.logging import ai_logger
from app.database.models.conversation import ConversationLanguage
from app.features.ai_chat.prompt_builder import build_system_prompt


class AIChatService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def generate_reply(
        self,
        *,
        system_prompt: str,
        scenario_title: str,
        scenario_description: str,
        scenario_difficulty: str,
        target_language: ConversationLanguage | str,
        conversation_history: Sequence[dict[str, str]],
    ) -> str:
        started_at = time.perf_counter()
        prompt = build_system_prompt(
            system_prompt=system_prompt,
            scenario_title=scenario_title,
            scenario_description=scenario_description,
            scenario_difficulty=scenario_difficulty,
            target_language=target_language,
            conversation_history=conversation_history,
        )
        cache_key = cache_service.make_key(
            "ai-response",
            json.dumps(
                {
                    "scenario_title": scenario_title,
                    "prompt": prompt,
                    "conversation_history": list(conversation_history),
                },
                sort_keys=True,
            ),
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

        if self._client is None:
            latest_user_message = next(
                (
                    message["content"]
                    for message in reversed(conversation_history)
                    if message["role"] == "user"
                ),
                "",
            )
            content = (
                f"[Mock AI: {scenario_title}] I received your message: "
                f"{latest_user_message}. Let's continue practicing."
            )
            ai_logger.info(
                "ai_reply_generated provider=mock scenario=%s latency_ms=%.2f history_count=%s",
                scenario_title,
                (time.perf_counter() - started_at) * 1000,
                len(conversation_history),
            )
            cache_service.set_string(cache_key, content, settings.redis_ai_cache_ttl_seconds)
            return content

        response = self._client.responses.create(
            model=settings.openai_model,
            input=[{"role": "system", "content": prompt}, *conversation_history],
        )
        content = response.output_text.strip()
        ai_logger.info(
            "ai_reply_generated provider=openai model=%s scenario=%s latency_ms=%.2f history_count=%s",
            settings.openai_model,
            scenario_title,
            (time.perf_counter() - started_at) * 1000,
            len(conversation_history),
        )
        cache_service.set_string(cache_key, content, settings.redis_ai_cache_ttl_seconds)
        return content


ai_chat_service = AIChatService()
