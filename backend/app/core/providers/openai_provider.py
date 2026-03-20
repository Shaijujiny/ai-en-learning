"""OpenAI provider — implements TextProvider and SpeechProvider."""
from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from openai import OpenAI

from app.core.config import settings
from app.core.providers.base import SpeechProvider, TextProvider


class OpenAITextProvider(TextProvider):
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key)

    def generate(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> str:
        response = self._client.responses.create(
            model=settings.openai_model,
            input=[{"role": "system", "content": system}, *messages],
        )
        return response.output_text.strip()

    def stream(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
    ) -> Iterator[str]:
        stream = self._client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "system", "content": system}, *messages],
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


class OpenAISpeechProvider(SpeechProvider):
    _VALID_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}

    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key)

    def transcribe(
        self,
        file_path: Path,
        *,
        language: str | None = None,
        prompt: str | None = None,
    ) -> str:
        with file_path.open("rb") as audio_file:
            transcription = self._client.audio.transcriptions.create(
                file=audio_file,
                model=settings.openai_whisper_model,
                language=language,
                prompt=prompt,
            )
        return transcription.text

    def transcribe_verbose(
        self,
        file_path: Path,
        *,
        language: str | None = None,
        prompt: str | None = None,
    ) -> dict:
        with file_path.open("rb") as audio_file:
            transcription = self._client.audio.transcriptions.create(
                file=audio_file,
                model=settings.openai_whisper_model,
                language=language,
                prompt=prompt,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
            )
        if hasattr(transcription, "model_dump"):
            return transcription.model_dump(mode="python")
        if isinstance(transcription, dict):
            return transcription
        return {"text": getattr(transcription, "text", "")}

    def synthesize(self, text: str, *, voice: str | None = None) -> bytes:
        selected_voice = voice if voice in self._VALID_VOICES else settings.openai_tts_voice
        response = self._client.audio.speech.create(
            model=settings.openai_tts_model,
            voice=selected_voice,
            input=text,
            response_format=settings.openai_tts_format,
        )
        return response.read()
