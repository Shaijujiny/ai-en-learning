from sqlalchemy.orm import Session

from app.database.models.scenario import Scenario


class ScenarioRepository:
    def list_all(self, db: Session) -> list[Scenario]:
        return db.query(Scenario).order_by(Scenario.id.asc()).all()


scenario_repository = ScenarioRepository()
