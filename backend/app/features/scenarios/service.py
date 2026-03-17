from sqlalchemy.orm import Session

from app.features.scenarios.repository import scenario_repository
from app.features.scenarios.schema import ScenarioResponse


class ScenarioService:
    def list_scenarios(self, db: Session, *, skip: int = 0, limit: int = 50) -> dict:
        scenarios = scenario_repository.list_all(db, skip=skip, limit=limit)
        total = scenario_repository.count_all(db)
        return {
            "items": [
                ScenarioResponse.model_validate(s).model_dump(mode="json")
                for s in scenarios
            ],
            "total": total,
            "skip": skip,
            "limit": limit,
        }


scenario_service = ScenarioService()
