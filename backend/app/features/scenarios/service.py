from sqlalchemy.orm import Session

from app.features.scenarios.repository import scenario_repository
from app.features.scenarios.schema import ScenarioResponse


class ScenarioService:
    def list_scenarios(self, db: Session) -> list[dict]:
        scenarios = scenario_repository.list_all(db)
        return [
            ScenarioResponse.model_validate(scenario).model_dump(mode="json")
            for scenario in scenarios
        ]


scenario_service = ScenarioService()
