from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.models.scenario import Scenario
from app.database.session import get_db
from app.features.scenarios.schemas import ScenarioResponse

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioResponse])
def list_scenarios(db: Session = Depends(get_db)) -> list[Scenario]:
    return db.query(Scenario).order_by(Scenario.id.asc()).all()
