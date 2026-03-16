from sqlalchemy.orm import Session

from app.database.models.scenario import Scenario
from app.database.models.skill_metric import SkillMetric
from app.database.models.user_score import UserScore


class CoachService:
    def generate_feedback(
        self,
        *,
        text: str,
        grammar_match_count: int,
        fluency_score: float | None,
        vocabulary_score: float | None,
    ) -> dict:
        grammar_suggestions = self.build_grammar_suggestions(
            text=text,
            grammar_match_count=grammar_match_count,
        )
        interview_suggestions = self.build_interview_suggestions(
            text=text,
            fluency_score=fluency_score,
            vocabulary_score=vocabulary_score,
        )
        overall_summary = self.build_overall_summary(
            grammar_match_count=grammar_match_count,
            fluency_score=fluency_score,
            vocabulary_score=vocabulary_score,
        )

        return {
            "summary": overall_summary,
            "grammar_suggestions": grammar_suggestions,
            "interview_answer_suggestions": interview_suggestions,
        }

    def build_learning_path(self, *, db: Session, user_id: int) -> dict:
        metrics = (
            db.query(SkillMetric)
            .filter(SkillMetric.user_id == user_id)
            .order_by(SkillMetric.metric_value.asc())
            .all()
        )
        recent_scores = (
            db.query(UserScore)
            .filter(UserScore.user_id == user_id)
            .order_by(UserScore.created_at.desc())
            .limit(10)
            .all()
        )
        scenarios = db.query(Scenario).order_by(Scenario.id.asc()).all()

        weakest_skills = [
            {
                "skill_name": metric.skill_name,
                "metric_value": float(metric.metric_value),
                "priority": self.skill_priority_label(float(metric.metric_value)),
            }
            for metric in metrics[:3]
        ]

        recommended_scenarios = self.recommend_scenarios(
            scenarios=scenarios,
            weakest_skills=weakest_skills,
        )

        focus_areas = self.build_focus_areas(weakest_skills=weakest_skills)
        recent_average = (
            round(
                sum(float(score.score_value) for score in recent_scores) / len(recent_scores),
                1,
            )
            if recent_scores
            else 0.0
        )

        return {
            "current_level": self.current_level_label(metrics),
            "recent_average_score": recent_average,
            "focus_areas": focus_areas,
            "recommended_scenarios": recommended_scenarios,
            "skill_improvements": weakest_skills,
        }

    def build_grammar_suggestions(self, *, text: str, grammar_match_count: int) -> list[str]:
        suggestions: list[str] = []
        if grammar_match_count == 0:
            suggestions.append("Your grammar is stable in this response. Keep the same sentence control.")
        else:
            suggestions.append(
                f"Review verb tense and agreement carefully. This response triggered {grammar_match_count} grammar issues."
            )
        if len(text.split()) < 10:
            suggestions.append("Use slightly longer sentences to show clearer relationships between ideas.")
        suggestions.append("Read your answer once before finalizing it to catch small grammar slips.")
        return suggestions[:3]

    def build_interview_suggestions(
        self,
        *,
        text: str,
        fluency_score: float | None,
        vocabulary_score: float | None,
    ) -> list[str]:
        suggestions: list[str] = []
        lower_text = text.lower()
        if not any(marker in lower_text for marker in ["because", "for example", "for instance", "so that"]):
            suggestions.append("Support your main point with a reason or short example.")
        if len(text.split()) < 20:
            suggestions.append("Expand your answer with more detail about your actions, decisions, or results.")
        if fluency_score is not None and fluency_score < 70:
            suggestions.append("Use smoother transitions so the answer sounds more natural and connected.")
        if vocabulary_score is not None and vocabulary_score < 70:
            suggestions.append("Add more precise technical or professional vocabulary where appropriate.")
        suggestions.append("Structure interview answers as situation, action, and result when possible.")
        return suggestions[:3]

    def build_overall_summary(
        self,
        *,
        grammar_match_count: int,
        fluency_score: float | None,
        vocabulary_score: float | None,
    ) -> str:
        grammar_state = "strong" if grammar_match_count == 0 else "needs attention"
        fluency_state = "solid" if (fluency_score or 0) >= 70 else "developing"
        vocabulary_state = "effective" if (vocabulary_score or 0) >= 70 else "basic"
        return (
            f"Grammar is {grammar_state}, fluency is {fluency_state}, and vocabulary is {vocabulary_state}. "
            "Focus on clearer support and more polished interview-style responses."
        )

    def recommend_scenarios(self, *, scenarios: list[Scenario], weakest_skills: list[dict]) -> list[dict]:
        if not weakest_skills:
            return [
                {
                    "scenario_id": scenario.id,
                    "title": scenario.title,
                    "difficulty": scenario.difficulty.value if hasattr(scenario.difficulty, "value") else str(scenario.difficulty),
                    "reason": "General practice to maintain current performance.",
                }
                for scenario in scenarios[:3]
            ]

        top_skill_names = {skill["skill_name"] for skill in weakest_skills}
        recommendations = []
        for scenario in scenarios:
            reason = "Useful for general communication practice."
            if "grammar_accuracy" in top_skill_names and scenario.title == "Casual Conversation":
                reason = "Lower-pressure repetition helps tighten grammar accuracy."
            elif "sentence_complexity" in top_skill_names and scenario.title == "Job Interview":
                reason = "Interview answers force more complete, structured responses."
            elif "advanced_vocabulary" in top_skill_names and scenario.title == "Customer Support":
                reason = "Support scenarios help build precise, professional vocabulary."

            recommendations.append(
                {
                    "scenario_id": scenario.id,
                    "title": scenario.title,
                    "difficulty": scenario.difficulty.value if hasattr(scenario.difficulty, "value") else str(scenario.difficulty),
                    "reason": reason,
                }
            )
        return recommendations[:3]

    def build_focus_areas(self, *, weakest_skills: list[dict]) -> list[str]:
        if not weakest_skills:
            return ["Maintain regular speaking practice across all scenarios."]

        mapping = {
            "fluency": "Speak in longer connected sentences with smoother transitions.",
            "grammar_accuracy": "Reduce tense and agreement mistakes in spoken answers.",
            "sentence_complexity": "Use more developed sentence structures and supporting clauses.",
            "word_diversity": "Avoid repeating the same simple words too often.",
            "advanced_vocabulary": "Use more precise professional and topic-specific vocabulary.",
        }
        return [mapping.get(skill["skill_name"], f"Improve {skill['skill_name']}.") for skill in weakest_skills]

    def current_level_label(self, metrics: list[SkillMetric]) -> str:
        if not metrics:
            return "Starting"
        average = sum(float(metric.metric_value) for metric in metrics) / len(metrics)
        if average >= 85:
            return "Advanced"
        if average >= 65:
            return "Intermediate"
        return "Beginner"

    def skill_priority_label(self, metric_value: float) -> str:
        if metric_value < 50:
            return "High"
        if metric_value < 75:
            return "Medium"
        return "Low"


coach_service = CoachService()
