"""Anthropic provider — implements TextProvider only.

Anthropic does not support speech-to-text or text-to-speech.
The factory always routes audio operations to OpenAI regardless of AI_PROVIDER.
"""
from __future__ import annotations

from collections.abc import Iterator

import anthropic

from app.core.config import settings
from app.core.providers.base import TextProvider


class AnthropicTextProvider(TextProvider):
    def __init__(self) -> None:
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def generate(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> str:
        response = self._client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text.strip()

    def stream(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        with self._client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        ) as stream:
            for text_chunk in stream.text_stream:
                yield text_chunk
