import re


class VocabularyService:
    WORD_PATTERN = re.compile(r"\b[a-zA-Z']+\b")
    ADVANCED_VOCABULARY = {
        "architecture",
        "articulate",
        "collaborate",
        "comprehensive",
        "configuration",
        "constraint",
        "coordinate",
        "demonstrate",
        "efficient",
        "elaborate",
        "evaluate",
        "flexible",
        "framework",
        "implement",
        "improve",
        "independent",
        "infrastructure",
        "maintainable",
        "optimize",
        "opportunity",
        "perspective",
        "precisely",
        "proactive",
        "reliable",
        "requirement",
        "significant",
        "strategy",
        "technical",
        "therefore",
        "understanding",
    }

    def analyze(self, text: str) -> dict:
        words = [word.lower() for word in self.WORD_PATTERN.findall(text)]
        unique_words = set(words)

        word_count = len(words)
        unique_word_count = len(unique_words)
        diversity_ratio = (
            unique_word_count / word_count if word_count else 0.0
        )
        advanced_words = sorted(
            {word for word in unique_words if word in self.ADVANCED_VOCABULARY}
        )
        advanced_word_count = len(advanced_words)

        diversity_score = self.calculate_diversity_score(
            diversity_ratio=diversity_ratio,
            word_count=word_count,
        )
        advanced_vocabulary_score = self.calculate_advanced_vocabulary_score(
            advanced_word_count=advanced_word_count,
            word_count=word_count,
        )
        overall_score = round((diversity_score + advanced_vocabulary_score) / 2, 1)

        return {
            "overall_score": overall_score,
            "word_diversity_score": diversity_score,
            "advanced_vocabulary_score": advanced_vocabulary_score,
            "word_count": word_count,
            "unique_word_count": unique_word_count,
            "diversity_ratio": round(diversity_ratio, 3),
            "advanced_word_count": advanced_word_count,
            "advanced_words": advanced_words,
            "summary": self.build_summary(
                diversity_score=diversity_score,
                advanced_vocabulary_score=advanced_vocabulary_score,
            ),
        }

    def calculate_diversity_score(
        self, *, diversity_ratio: float, word_count: int
    ) -> float:
        if word_count == 0:
            return 0.0

        base_score = min(diversity_ratio * 100, 85)
        volume_bonus = 10 if word_count >= 20 else 5 if word_count >= 10 else 0
        return round(min(base_score + volume_bonus, 100), 1)

    def calculate_advanced_vocabulary_score(
        self, *, advanced_word_count: int, word_count: int
    ) -> float:
        if word_count == 0:
            return 0.0

        ratio = advanced_word_count / word_count
        return round(min(ratio * 400 + advanced_word_count * 6, 100), 1)

    def build_summary(
        self, *, diversity_score: float, advanced_vocabulary_score: float
    ) -> str:
        diversity_label = self.label_score(diversity_score)
        advanced_label = self.label_score(advanced_vocabulary_score)
        return (
            f"Word diversity is {diversity_label.lower()} and advanced vocabulary usage is "
            f"{advanced_label.lower()}."
        )

    def label_score(self, score: float) -> str:
        if score >= 85:
            return "Strong"
        if score >= 65:
            return "Good"
        if score >= 40:
            return "Developing"
        return "Basic"


vocabulary_service = VocabularyService()
