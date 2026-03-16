from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.analytics_service import analytics_service
from app.core.cefr_service import cefr_service
from app.core.fluency_service import fluency_service
from app.core.grammar_service import grammar_service
from app.core.lesson_service import lesson_service
from app.core.mistake_memory_service import mistake_memory_service
from app.core.vocabulary_service import vocabulary_service
from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.user import User
from app.database.session import get_db
from app.features.analysis.schemas import (
    FluencyAnalysisRequest,
    FluencyAnalysisResponse,
    GrammarAnalysisMatch,
    GrammarAnalysisRequest,
    GrammarAnalysisResponse,
    VocabularyAnalysisRequest,
    VocabularyAnalysisResponse,
)
from app.features.auth.dependencies import get_current_user
from app.utils.helpers import build_response

router = APIRouter(prefix="/analysis", tags=["analysis"])


def resolve_analysis_text(
    *,
    text: str | None,
    message_id: int | None,
    db: Session,
    current_user: User,
) -> str:
    resolved_text = text

    if message_id is not None:
        message = (
            db.query(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .filter(Message.id == message_id)
            .filter(Conversation.user_id == current_user.id)
            .first()
        )
        if message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found",
            )
        resolved_text = message.content

    if not resolved_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text is required for analysis.",
        )

    return resolved_text


@router.post("/grammar")
def analyze_grammar(
    payload: GrammarAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = resolve_analysis_text(
        text=payload.text,
        message_id=payload.message_id,
        db=db,
        current_user=current_user,
    )

    result = grammar_service.safe_analyze_text(text)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Grammar analysis failed.",
        )

    matches = [
        GrammarAnalysisMatch(
            message=match.get("message", ""),
            short_message=match.get("shortMessage", ""),
            offset=match.get("offset", 0),
            length=match.get("length", 0),
            sentence=match.get("sentence", ""),
            replacements=[
                replacement.get("value", "")
                for replacement in match.get("replacements", [])
            ],
            rule_id=match.get("rule", {}).get("id", ""),
            category=match.get("rule", {}).get("category", {}).get("name", ""),
        )
        for match in result.get("matches", [])
    ]

    mistake_memory_service.record_grammar_matches(
        db=db,
        user=current_user,
        text=text,
        matches=result.get("matches", []),
    )
    mistake_memory_service.record_repeated_words(
        db=db,
        user=current_user,
        text=text,
    )
    db.commit()

    response = GrammarAnalysisResponse(
        text=text,
        match_count=len(matches),
        matches=matches,
    )
    return build_response("Grammar analysis completed", response.model_dump(mode="json"))


@router.post("/fluency")
def analyze_fluency(
    payload: FluencyAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = resolve_analysis_text(
        text=payload.text,
        message_id=payload.message_id,
        db=db,
        current_user=current_user,
    )

    grammar_result = grammar_service.safe_analyze_text(text)
    if grammar_result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Fluency analysis failed because grammar analysis failed.",
        )

    grammar_match_count = len(grammar_result.get("matches", []))
    fluency_result = fluency_service.analyze(
        text=text,
        grammar_match_count=grammar_match_count,
    )
    analytics_service.record_score(
        db=db,
        user_id=current_user.id,
        conversation_id=None,
        score_type="fluency",
        score_value=fluency_result["overall_score"],
        feedback=fluency_result["summary"],
    )
    analytics_service.upsert_skill_metric(
        db=db,
        user_id=current_user.id,
        skill_name="fluency",
        metric_value=fluency_result["overall_score"],
    )
    analytics_service.upsert_skill_metric(
        db=db,
        user_id=current_user.id,
        skill_name="grammar_accuracy",
        metric_value=fluency_result["grammar_accuracy_score"],
    )
    analytics_service.upsert_skill_metric(
        db=db,
        user_id=current_user.id,
        skill_name="sentence_complexity",
        metric_value=fluency_result["sentence_complexity_score"],
    )
    weakest_skill = min(
        {
            "grammar_accuracy": float(fluency_result["grammar_accuracy_score"]),
            "fluency": float(fluency_result["overall_score"]),
            "sentence_complexity": float(fluency_result["sentence_complexity_score"]),
        },
        key=lambda key: {
            "grammar_accuracy": float(fluency_result["grammar_accuracy_score"]),
            "fluency": float(fluency_result["overall_score"]),
            "sentence_complexity": float(fluency_result["sentence_complexity_score"]),
        }[key],
    )
    cefr_service.update_user_level(
        db=db,
        user=current_user,
        overall_score=float(fluency_result["overall_score"]),
        skill_breakdown={
            "grammar_accuracy": float(fluency_result["grammar_accuracy_score"]),
            "fluency": float(fluency_result["overall_score"]),
            "sentence_complexity": float(fluency_result["sentence_complexity_score"]),
        },
        source="fluency_analysis",
        sample_count=max(fluency_result["sentence_count"], 1),
    )
    lesson_service.generate_lessons(
        db=db,
        user=current_user,
        weakest_skill=weakest_skill,
    )
    db.commit()

    response = FluencyAnalysisResponse(
        text=text,
        grammar_match_count=grammar_match_count,
        **fluency_result,
    )
    return build_response("Fluency analysis completed", response.model_dump(mode="json"))


@router.post("/vocabulary")
def analyze_vocabulary(
    payload: VocabularyAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = resolve_analysis_text(
        text=payload.text,
        message_id=payload.message_id,
        db=db,
        current_user=current_user,
    )

    vocabulary_result = vocabulary_service.analyze(text)
    analytics_service.record_score(
        db=db,
        user_id=current_user.id,
        conversation_id=None,
        score_type="vocabulary",
        score_value=vocabulary_result["overall_score"],
        feedback=vocabulary_result["summary"],
    )
    analytics_service.upsert_skill_metric(
        db=db,
        user_id=current_user.id,
        skill_name="word_diversity",
        metric_value=vocabulary_result["word_diversity_score"],
    )
    analytics_service.upsert_skill_metric(
        db=db,
        user_id=current_user.id,
        skill_name="advanced_vocabulary",
        metric_value=vocabulary_result["advanced_vocabulary_score"],
    )
    mistake_memory_service.record_repeated_words(
        db=db,
        user=current_user,
        text=text,
    )
    weakest_skill = min(
        {
            "word_diversity": float(vocabulary_result["word_diversity_score"]),
            "advanced_vocabulary": float(vocabulary_result["advanced_vocabulary_score"]),
        },
        key=lambda key: {
            "word_diversity": float(vocabulary_result["word_diversity_score"]),
            "advanced_vocabulary": float(vocabulary_result["advanced_vocabulary_score"]),
        }[key],
    )
    cefr_service.update_user_level(
        db=db,
        user=current_user,
        overall_score=float(vocabulary_result["overall_score"]),
        skill_breakdown={
            "word_diversity": float(vocabulary_result["word_diversity_score"]),
            "advanced_vocabulary": float(vocabulary_result["advanced_vocabulary_score"]),
        },
        source="vocabulary_analysis",
        sample_count=max(vocabulary_result["word_count"], 1),
    )
    lesson_service.generate_lessons(
        db=db,
        user=current_user,
        weakest_skill=weakest_skill,
    )
    db.commit()

    response = VocabularyAnalysisResponse(
        text=text,
        **vocabulary_result,
    )
    return build_response("Vocabulary analysis completed", response.model_dump(mode="json"))
