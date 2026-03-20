"""Abstract base classes for AI provider implementations.

Strategy pattern: each provider implements TextProvider and/or SpeechProvider.
Add new providers by subclassing these ABCs without touching business logic.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from pathlib import Path


class TextProvider(ABC):
    """Text generation — implemented by OpenAI and Anthropic providers."""

    @abstractmethod
    def generate(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> str:
        """Return a complete text reply."""

    @abstractmethod
    def stream(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        """Yield text reply token-by-token."""


class SpeechProvider(ABC):
    """Speech-to-text and text-to-speech — implemented by OpenAI only.

    Anthropic does not support audio; the factory always returns an
    OpenAI speech provider regardless of AI_PROVIDER setting.
    """

    @abstractmethod
    def transcribe(
        self,
        file_path: Path,
        *,
        language: str | None = None,
        prompt: str | None = None,
    ) -> str:
        """Transcribe audio file to text."""

    @abstractmethod
    def transcribe_verbose(
        self,
        file_path: Path,
        *,
        language: str | None = None,
        prompt: str | None = None,
    ) -> dict:
        """Transcribe with word/segment timestamps."""

    @abstractmethod
    def synthesize(self, text: str, *, voice: str | None = None) -> bytes:
        """Synthesize speech from text, return raw audio bytes."""
