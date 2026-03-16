from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models.conversation import Conversation
from app.database.models.message import Message
from app.database.models.scenario import Scenario
from app.database.models.skill_metric import SkillMetric
from app.database.models.user import User
from app.database.models.user_score import UserScore
from app.database.session import get_db
from app.features.admin.schemas import (
    AdminAnalyticsOverviewResponse,
    AdminScenarioRequest,
    AdminScenarioResponse,
    AdminUsageResponse,
)
from app.features.auth.dependencies import get_current_admin
from app.utils.helpers import build_response

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/scenarios")
def list_admin_scenarios(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    scenarios = db.query(Scenario).order_by(Scenario.id.asc()).all()
    return build_response(
        "Admin scenario list",
        [
            AdminScenarioResponse.model_validate(scenario).model_dump(mode="json")
            for scenario in scenarios
        ],
    )


@router.post("/scenarios", status_code=status.HTTP_201_CREATED)
def create_admin_scenario(
    payload: AdminScenarioRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    scenario = Scenario(
        title=payload.title,
        description=payload.description,
        difficulty=payload.difficulty,
        system_prompt=payload.system_prompt,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return build_response(
        "Scenario created successfully",
        AdminScenarioResponse.model_validate(scenario).model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


@router.put("/scenarios/{scenario_id}")
def update_admin_scenario(
    scenario_id: int,
    payload: AdminScenarioRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scenario.title = payload.title
    scenario.description = payload.description
    scenario.difficulty = payload.difficulty
    scenario.system_prompt = payload.system_prompt
    db.commit()
    db.refresh(scenario)
    return build_response(
        "Scenario updated successfully",
        AdminScenarioResponse.model_validate(scenario).model_dump(mode="json"),
    )


@router.get("/usage")
def get_admin_usage(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    language_rows = (
        db.query(Conversation.language, func.count(Conversation.id))
        .group_by(Conversation.language)
        .all()
    )
    response = AdminUsageResponse(
        total_users=db.query(User).count(),
        total_conversations=db.query(Conversation).count(),
        total_messages=db.query(Message).count(),
        total_scores=db.query(UserScore).count(),
        language_usage={
            language.value if hasattr(language, "value") else str(language): count
            for language, count in language_rows
        },
    )
    return build_response("Admin usage overview", response.model_dump(mode="json"))


@router.get("/analytics")
def get_admin_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    scores = db.query(UserScore).all()
    average_performance_score = (
        round(sum(float(score.score_value) for score in scores) / len(scores), 1)
        if scores
        else 0.0
    )
    top_skill_metrics = (
        db.query(SkillMetric)
        .order_by(SkillMetric.metric_value.desc())
        .limit(5)
        .all()
    )
    response = AdminAnalyticsOverviewResponse(
        average_performance_score=average_performance_score,
        total_skill_metrics=db.query(SkillMetric).count(),
        top_skill_metrics=[
            {
                "skill_name": metric.skill_name,
                "metric_value": float(metric.metric_value),
            }
            for metric in top_skill_metrics
        ],
    )
    return build_response("Admin analytics overview", response.model_dump(mode="json"))
