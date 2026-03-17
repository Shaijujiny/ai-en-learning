import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.core.config import settings
from app.core.logging import error_logger
from app.core.rate_limit_service import rate_limit_service
from app.core.speech_service import speech_service
from app.database.models.user import User
from app.features.auth.dependencies import get_current_user
from app.features.speech.schemas import SpeechSynthesisRequest, SpeechTranscriptionResponse
from app.utils.helpers import build_response

router = APIRouter(prefix="/speech", tags=["speech"])

ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".m4a",
    ".ogg",
    ".wav",
    ".webm",
}


@router.post(
    "/transcribe",
    status_code=status.HTTP_200_OK,
)
async def transcribe_speech(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    prompt: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
):
    if not speech_service.available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech transcription is unavailable. Set OPENAI_API_KEY first.",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audio format.",
        )

    allowed, _ = rate_limit_service.hit(
        key=f"rate:speech:transcribe:user:{current_user.id}",
        limit=settings.speech_transcribe_per_minute,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many transcription requests. Please wait and try again.",
        )

    temp_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            audio_bytes = await file.read()
            max_bytes = settings.speech_max_upload_mb * 1024 * 1024
            if len(audio_bytes) > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Audio file is too large. Max {settings.speech_max_upload_mb}MB.",
                )
            temp_file.write(audio_bytes)
            temp_path = Path(temp_file.name)

        text = speech_service.transcribe_file(
            temp_path,
            language=language,
            prompt=prompt,
        )
        return build_response(
            "Speech transcribed successfully",
            SpeechTranscriptionResponse(text=text).model_dump(mode="json"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        error_logger.exception(
            "speech_transcription_failed filename=%s content_type=%s",
            file.filename,
            file.content_type,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Speech transcription failed.",
        ) from exc
    finally:
        await file.close()
        if temp_path is not None and temp_path.exists():
            os.unlink(temp_path)


@router.post("/synthesize", status_code=status.HTTP_200_OK)
async def synthesize_speech(
    payload: SpeechSynthesisRequest,
    current_user: User = Depends(get_current_user),
) -> Response:
    if not speech_service.available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech synthesis is unavailable. Set OPENAI_API_KEY first.",
        )

    allowed, _ = rate_limit_service.hit(
        key=f"rate:speech:synthesize:user:{current_user.id}",
        limit=settings.speech_synthesize_per_minute,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many speech synthesis requests. Please wait and try again.",
        )

    try:
        audio_bytes = speech_service.synthesize_speech(payload.text, voice=payload.voice)
        return Response(
            content=audio_bytes,
            media_type=speech_service.tts_content_type,
            headers={
                "Content-Disposition": f"inline; filename=reply.{settings.openai_tts_format}"
            },
        )
    except Exception as exc:
        error_logger.exception("speech_synthesis_failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Speech synthesis failed.",
        ) from exc
