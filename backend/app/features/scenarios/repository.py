from sqlalchemy.orm import Session

from app.database.models.scenario import Scenario


class ScenarioRepository:
    def list_all(self, db: Session, *, skip: int = 0, limit: int = 50) -> list[Scenario]:
        return db.query(Scenario).order_by(Scenario.id.asc()).offset(skip).limit(limit).all()

    def count_all(self, db: Session) -> int:
        return db.query(Scenario).count()


scenario_repository = ScenarioRepository()
