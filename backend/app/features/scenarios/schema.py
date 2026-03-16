from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.database.models.scenario import ScenarioDifficulty


class ScenarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    difficulty: ScenarioDifficulty
    system_prompt: str
    created_at: datetime
    updated_at: datetime
