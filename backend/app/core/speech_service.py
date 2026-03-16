from pathlib import Path

from openai import OpenAI

from app.core.config import settings
from app.core.logging import ai_logger


class SpeechService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    @property
    def available(self) -> bool:
        return self._client is not None

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
        if self._client is None:
            raise RuntimeError("Speech transcription is unavailable without OPENAI_API_KEY.")

        with file_path.open("rb") as audio_file:
            transcription = self._client.audio.transcriptions.create(
                file=audio_file,
                model=settings.openai_whisper_model,
                language=language,
                prompt=prompt,
            )

        ai_logger.info(
            "speech_transcribed provider=openai model=%s filename=%s",
            settings.openai_whisper_model,
            file_path.name,
        )
        return transcription.text

    def synthesize_speech(self, text: str) -> bytes:
        if self._client is None:
            raise RuntimeError("Speech synthesis is unavailable without OPENAI_API_KEY.")

        response = self._client.audio.speech.create(
            model=settings.openai_tts_model,
            voice=settings.openai_tts_voice,
            input=text,
            response_format=settings.openai_tts_format,
        )

        ai_logger.info(
            "speech_synthesized provider=openai model=%s voice=%s format=%s",
            settings.openai_tts_model,
            settings.openai_tts_voice,
            settings.openai_tts_format,
        )
        return response.read()


speech_service = SpeechService()
