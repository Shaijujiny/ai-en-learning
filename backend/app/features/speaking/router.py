import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.analytics_service import analytics_service
from app.core.speaking_service import speaking_service
from app.core.speech_service import speech_service
from app.database.models.speaking_analysis import SpeakingAnalysis
from app.database.models.user import User
from app.database.session import get_db
from app.features.auth.dependencies import get_current_user
from app.features.speaking.schemas import SpeakingAnalysisResponse
from app.utils.helpers import build_response

router = APIRouter(prefix="/speaking", tags=["speaking"])

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

@router.get("/latest", status_code=status.HTTP_200_OK)
def get_latest_speaking_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = (
        db.query(SpeakingAnalysis)
        .filter(SpeakingAnalysis.user_id == current_user.id)
        .order_by(SpeakingAnalysis.created_at.desc())
        .first()
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No speaking analysis found.",
        )

    analysis = record.analysis if isinstance(record.analysis, dict) else {}
    response = SpeakingAnalysisResponse(
        analysis_id=record.id,
        transcript=analysis.get("transcript", record.transcript),
        pronunciation=analysis.get("pronunciation", {}),
        intonation=analysis.get("intonation", {}),
        confidence=analysis.get("confidence", {}),
        meta=analysis.get("meta", {}),
    )
    return build_response(
        "Latest speaking analysis",
        response.model_dump(mode="json"),
    )


@router.post("/analyze", status_code=status.HTTP_200_OK)
async def analyze_speaking(
    file: UploadFile = File(...),
    conversation_id: int | None = Form(default=None),
    assessment_session_id: int | None = Form(default=None),
    language: str | None = Form(default=None),
    prompt: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not speech_service.available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speaking analysis is unavailable. Set OPENAI_API_KEY first.",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audio format.",
        )

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(await file.read())
            temp_path = Path(temp_file.name)

        try:
            transcription_payload = speech_service.transcribe_file_with_timestamps(
                temp_path,
                language=language,
                prompt=prompt,
            )
            transcript = (
                transcription_payload.get("text")
                if isinstance(transcription_payload, dict)
                else None
            )
            if not transcript:
                raise RuntimeError("Verbose transcription missing text.")
        except Exception:
            transcript = speech_service.transcribe_file(
                temp_path,
                language=language,
                prompt=prompt,
            )
            transcription_payload = {"text": transcript}

        analysis = speaking_service.analyze(
            transcript=transcript,
            transcription_payload=transcription_payload,
        )

        record = SpeakingAnalysis(
            user_id=current_user.id,
            conversation_id=conversation_id,
            assessment_session_id=assessment_session_id,
            transcript=analysis["transcript"],
            pronunciation_score=analysis["pronunciation"]["overall_score"],
            confidence_score=analysis["confidence"]["overall_score"],
            analysis=analysis,
        )
        db.add(record)

        analytics_service.record_score(
            db=db,
            user_id=current_user.id,
            conversation_id=conversation_id,
            score_type="pronunciation",
            score_value=float(analysis["pronunciation"]["overall_score"]),
            feedback=None,
        )
        analytics_service.record_score(
            db=db,
            user_id=current_user.id,
            conversation_id=conversation_id,
            score_type="speaking_confidence",
            score_value=float(analysis["confidence"]["overall_score"]),
            feedback=None,
        )
        analytics_service.upsert_skill_metric(
            db=db,
            user_id=current_user.id,
            skill_name="pronunciation",
            metric_value=float(analysis["pronunciation"]["overall_score"]),
        )
        analytics_service.upsert_skill_metric(
            db=db,
            user_id=current_user.id,
            skill_name="speaking_confidence",
            metric_value=float(analysis["confidence"]["overall_score"]),
        )

        db.commit()

        response = SpeakingAnalysisResponse(
            analysis_id=record.id,
            transcript=analysis["transcript"],
            pronunciation=analysis["pronunciation"],
            intonation=analysis["intonation"],
            confidence=analysis["confidence"],
            meta=analysis["meta"],
        )
        return build_response(
            "Speaking analysis completed",
            response.model_dump(mode="json"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Speaking analysis failed.",
        ) from exc
    finally:
        await file.close()
        if temp_path is not None and temp_path.exists():
            os.unlink(temp_path)
