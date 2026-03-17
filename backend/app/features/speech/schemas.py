from pydantic import BaseModel


class SpeechTranscriptionResponse(BaseModel):
    text: str


VALID_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}


class SpeechSynthesisRequest(BaseModel):
    text: str
    voice: str | None = None  # alloy | echo | fable | onyx | nova | shimmer
