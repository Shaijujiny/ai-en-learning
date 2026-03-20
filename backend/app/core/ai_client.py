"""AIClient — thin facade over the configured text provider.

Business logic calls this class without knowing which provider is active.
Switch providers by changing AI_PROVIDER in your .env.
"""
from __future__ import annotations

from collections.abc import Iterator

from app.core.config import settings
from app.core.providers.base import TextProvider


class AIClient:
    """Facade over OpenAI or Anthropic text provider, selected via AI_PROVIDER."""

    def __init__(self) -> None:
        provider_name = (settings.ai_provider or "openai").strip().lower()
        self._provider_name = provider_name
        self._provider: TextProvider | None = None
        self._available = False

        if provider_name == "anthropic" and settings.anthropic_api_key:
            from app.core.providers.anthropic_provider import AnthropicTextProvider
            self._provider = AnthropicTextProvider()
            self._available = True
        elif provider_name != "anthropic" and settings.openai_api_key:
            from app.core.providers.openai_provider import OpenAITextProvider
            self._provider = OpenAITextProvider()
            self._available = True

    @property
    def available(self) -> bool:
        return self._available

    @property
    def provider(self) -> str:
        return self._provider_name

    def create_message(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> str:
        """Generate a complete text reply. Raises RuntimeError if no key is configured."""
        if not self._available or self._provider is None:
            raise RuntimeError(self._missing_key_msg())
        return self._provider.generate(system=system, messages=messages, max_tokens=max_tokens)

    def stream_message(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        """Stream text reply token-by-token. Raises RuntimeError if no key is configured."""
        if not self._available or self._provider is None:
            raise RuntimeError(self._missing_key_msg())
        yield from self._provider.stream(system=system, messages=messages, max_tokens=max_tokens)

    def _missing_key_msg(self) -> str:
        if self._provider_name == "anthropic":
            return (
                "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not configured. "
                "Please set ANTHROPIC_API_KEY in your environment."
            )
        return (
            "AI_PROVIDER=openai but OPENAI_API_KEY is not configured. "
            "Please set OPENAI_API_KEY in your environment."
        )
