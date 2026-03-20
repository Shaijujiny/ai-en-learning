"""Speech service — always uses OpenAI (Whisper + TTS).

Anthropic has no audio support. When AI_PROVIDER=anthropic, speech
automatically falls back to OpenAI. OPENAI_API_KEY is required for
speech features regardless of AI_PROVIDER.
"""
from pathlib import Path

from app.core.config import settings
from app.core.logging import ai_logger
from app.core.providers.base import SpeechProvider


class SpeechService:
    def __init__(self) -> None:
        self._provider: SpeechProvider | None = None
        if settings.openai_api_key:
            from app.core.providers.openai_provider import OpenAISpeechProvider
            self._provider = OpenAISpeechProvider()

    @property
    def available(self) -> bool:
        return self._provider is not None

    @property
    def tts_content_type(self) -> str:
        if settings.openai_tts_format == "wav":
            return "audio/wav"
        return "audio/mpeg"

    def transcribe_file(
        self,
        file_path: Path,
        *,
        language: str | None = None,
        prompt: str | None = None,
    ) -> str:
        if self._provider is None:
            raise RuntimeError(
                "Speech transcription requires OPENAI_API_KEY. "
                "Anthropic does not support STT — OpenAI is always used for speech, "
                "even when AI_PROVIDER=anthropic."
            )
        result = self._provider.transcribe(file_path, language=language, prompt=prompt)
        ai_logger.info(
            "speech_transcribed provider=openai model=%s filename=%s",
            settings.openai_whisper_model,
            file_path.name,
        )
        return result

    def transcribe_file_with_timestamps(
        self,
        file_path: Path,
        *,
        language: str | None = None,
        prompt: str | None = None,
    ) -> dict:
        """
        Returns a best-effort verbose transcription payload (text + timestamps when available).

        The exact schema depends on the upstream provider/model, so callers should treat the
        returned dict as untrusted and access keys defensively.
        """
        if self._provider is None:
            raise RuntimeError(
                "Speech transcription requires OPENAI_API_KEY. "
                "Anthropic does not support STT — OpenAI is always used for speech, "
                "even when AI_PROVIDER=anthropic."
            )
        result = self._provider.transcribe_verbose(file_path, language=language, prompt=prompt)
        ai_logger.info(
            "speech_transcribed_verbose provider=openai model=%s filename=%s",
            settings.openai_whisper_model,
            file_path.name,
        )
        return result

    _VALID_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}

    def synthesize_speech(self, text: str, *, voice: str | None = None) -> bytes:
        if self._provider is None:
            raise RuntimeError(
                "Speech synthesis requires OPENAI_API_KEY. "
                "Anthropic does not support TTS — OpenAI is always used for speech, "
                "even when AI_PROVIDER=anthropic."
            )
        result = self._provider.synthesize(text, voice=voice)
        selected_voice = voice if voice in self._VALID_VOICES else settings.openai_tts_voice
        ai_logger.info(
            "speech_synthesized provider=openai model=%s voice=%s format=%s",
            settings.openai_tts_model,
            selected_voice,
            settings.openai_tts_format,
        )
        return result


speech_service = SpeechService()
