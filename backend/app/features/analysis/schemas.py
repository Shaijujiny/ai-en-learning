from pydantic import BaseModel, Field


class GrammarAnalysisRequest(BaseModel):
    text: str | None = Field(default=None, max_length=5000)
    message_id: int | None = None


class GrammarAnalysisMatch(BaseModel):
    message: str
    short_message: str
    offset: int
    length: int
    sentence: str
    replacements: list[str]
    rule_id: str
    category: str


class GrammarAnalysisResponse(BaseModel):
    text: str
    match_count: int
    matches: list[GrammarAnalysisMatch]


class FluencyAnalysisRequest(BaseModel):
    text: str | None = Field(default=None, max_length=5000)
    message_id: int | None = None


class FluencyAnalysisResponse(BaseModel):
    text: str
    overall_score: float
    sentence_complexity_score: float
    grammar_accuracy_score: float
    sentence_count: int
    word_count: int
    average_words_per_sentence: float
    complexity_marker_count: int
    grammar_match_count: int
    summary: str


class VocabularyAnalysisRequest(BaseModel):
    text: str | None = Field(default=None, max_length=5000)
    message_id: int | None = None


class VocabularyAnalysisResponse(BaseModel):
    text: str
    overall_score: float
    word_diversity_score: float
    advanced_vocabulary_score: float
    word_count: int
    unique_word_count: int
    diversity_ratio: float
    advanced_word_count: int
    advanced_words: list[str]
    summary: str
