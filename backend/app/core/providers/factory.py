"""Provider factory — resolves the correct AI provider from settings.

Usage:
    text_provider = create_text_provider()    # raises if key missing
    speech_provider = create_speech_provider()  # always OpenAI; raises if OPENAI_API_KEY missing
"""
from __future__ import annotations

from app.core.config import settings
from app.core.providers.base import SpeechProvider, TextProvider


def create_text_provider() -> TextProvider:
    """Return the configured TextProvider, or raise RuntimeError if key is missing."""
    provider = (settings.ai_provider or "openai").strip().lower()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not configured. "
                "Please set ANTHROPIC_API_KEY in your environment."
            )
        from app.core.providers.anthropic_provider import AnthropicTextProvider
        return AnthropicTextProvider()

    # default: openai
    if not settings.openai_api_key:
        raise RuntimeError(
            "AI_PROVIDER=openai but OPENAI_API_KEY is not configured. "
            "Please set OPENAI_API_KEY in your environment."
        )
    from app.core.providers.openai_provider import OpenAITextProvider
    return OpenAITextProvider()


def create_speech_provider() -> SpeechProvider:
    """Return OpenAI speech provider.

    Speech (STT/TTS) always uses OpenAI — Anthropic has no audio support.
    Falls back to OpenAI even when AI_PROVIDER=anthropic.
    Raises RuntimeError if OPENAI_API_KEY is not set.
    """
    if not settings.openai_api_key:
        raise RuntimeError(
            "Speech features (STT/TTS) require OPENAI_API_KEY. "
            "Anthropic does not support audio — OpenAI is always used for speech, "
            "even when AI_PROVIDER=anthropic."
        )
    from app.core.providers.openai_provider import OpenAISpeechProvider
    return OpenAISpeechProvider()
