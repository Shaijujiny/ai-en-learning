from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.features.scenarios.service import scenario_service
from app.utils.helpers import build_response

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("")
def list_scenarios(db: Session = Depends(get_db)):
    return build_response("Scenario list", scenario_service.list_scenarios(db))
