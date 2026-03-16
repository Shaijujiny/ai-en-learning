from pydantic import BaseModel


class SpeechTranscriptionResponse(BaseModel):
    text: str


class SpeechSynthesisRequest(BaseModel):
    text: str
