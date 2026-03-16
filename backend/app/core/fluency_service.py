import re


class FluencyService:
    SENTENCE_SPLIT_PATTERN = re.compile(r"[.!?]+")
    WORD_PATTERN = re.compile(r"\b[\w']+\b")
    COMPLEXITY_MARKERS = {
        "because",
        "although",
        "however",
        "while",
        "unless",
        "therefore",
        "instead",
        "which",
        "that",
        "since",
        "though",
    }

    def analyze(self, text: str, grammar_match_count: int) -> dict:
        sentences = self.extract_sentences(text)
        words = self.extract_words(text)
        word_count = len(words)
        sentence_count = max(len(sentences), 1)
        avg_words_per_sentence = word_count / sentence_count if word_count else 0.0
        complexity_marker_count = sum(
            1 for word in words if word.lower() in self.COMPLEXITY_MARKERS
        )

        complexity_score = self.calculate_complexity_score(
            avg_words_per_sentence=avg_words_per_sentence,
            complexity_marker_count=complexity_marker_count,
            sentence_count=sentence_count,
        )
        grammar_accuracy_score = self.calculate_grammar_accuracy_score(
            grammar_match_count=grammar_match_count,
            word_count=word_count,
        )
        overall_score = round((complexity_score + grammar_accuracy_score) / 2, 1)

        return {
            "overall_score": overall_score,
            "sentence_complexity_score": complexity_score,
            "grammar_accuracy_score": grammar_accuracy_score,
            "sentence_count": sentence_count,
            "word_count": word_count,
            "average_words_per_sentence": round(avg_words_per_sentence, 1),
            "complexity_marker_count": complexity_marker_count,
            "summary": self.build_summary(
                complexity_score=complexity_score,
                grammar_accuracy_score=grammar_accuracy_score,
            ),
        }

    def extract_sentences(self, text: str) -> list[str]:
        sentences = [sentence.strip() for sentence in self.SENTENCE_SPLIT_PATTERN.split(text)]
        return [sentence for sentence in sentences if sentence]

    def extract_words(self, text: str) -> list[str]:
        return self.WORD_PATTERN.findall(text)

    def calculate_complexity_score(
        self,
        *,
        avg_words_per_sentence: float,
        complexity_marker_count: int,
        sentence_count: int,
    ) -> float:
        base_score = min(avg_words_per_sentence * 4.5, 70)
        marker_bonus = min(complexity_marker_count * 6, 20)
        sentence_bonus = min(sentence_count * 2, 10)
        return round(min(base_score + marker_bonus + sentence_bonus, 100), 1)

    def calculate_grammar_accuracy_score(
        self, *, grammar_match_count: int, word_count: int
    ) -> float:
        if word_count == 0:
            return 0.0

        penalty = (grammar_match_count / max(word_count, 1)) * 100 * 3
        return round(max(100 - penalty, 0), 1)

    def build_summary(
        self, *, complexity_score: float, grammar_accuracy_score: float
    ) -> str:
        complexity_label = self.label_score(complexity_score)
        grammar_label = self.label_score(grammar_accuracy_score)
        return (
            f"Sentence complexity is {complexity_label.lower()} and grammar accuracy is "
            f"{grammar_label.lower()}."
        )

    def label_score(self, score: float) -> str:
        if score >= 85:
            return "Strong"
        if score >= 65:
            return "Good"
        if score >= 40:
            return "Developing"
        return "Basic"


fluency_service = FluencyService()
