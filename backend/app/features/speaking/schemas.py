from pydantic import BaseModel


class SpeakingAnalysisResponse(BaseModel):
    analysis_id: int
    transcript: str
    pronunciation: dict
    intonation: dict
    confidence: dict
    meta: dict
