from collections.abc import Sequence

from app.database.models.conversation import ConversationLanguage


def build_recent_context(
    conversation_history: Sequence[dict[str, str]], limit: int = 6
) -> str:
    recent_messages = conversation_history[-limit:]
    if not recent_messages:
        return "No prior messages yet."

    return "\n".join(
        f"- {message['role']}: {message['content']}" for message in recent_messages
    )


def build_previous_answers(
    conversation_history: Sequence[dict[str, str]], limit: int = 5
) -> str:
    user_messages = [
        message["content"] for message in conversation_history if message["role"] == "user"
    ]
    if not user_messages:
        return "No prior user answers yet."

    return "\n".join(f"- {message}" for message in user_messages[-limit:])


def build_system_prompt(
    *,
    system_prompt: str,
    scenario_title: str,
    scenario_description: str,
    scenario_difficulty: str,
    target_language: ConversationLanguage | str,
    conversation_history: Sequence[dict[str, str]],
    current_level: str | None,
    skill_breakdown: dict[str, float],
    correction_mode: str,
    mistake_memory: Sequence[dict[str, str | None]],
) -> str:
    recent_context = build_recent_context(conversation_history)
    previous_answers = build_previous_answers(conversation_history)
    weakest_skill = (
        min(skill_breakdown, key=skill_breakdown.get) if skill_breakdown else "fluency"
    )
    adaptation_profile = build_adaptation_profile(
        current_level=current_level,
        scenario_difficulty=scenario_difficulty,
        weakest_skill=weakest_skill,
    )
    correction_profile = build_correction_profile(correction_mode)
    mistakes = build_mistake_memory(mistake_memory)
    return (
        f"You are running the scenario: {scenario_title}.\n"
        f"Scenario description: {scenario_description}\n"
        f"Difficulty: {scenario_difficulty}\n"
        f"User CEFR level: {current_level or 'Unknown'}\n"
        f"Respond in this language: {target_language}\n"
        f"Primary instructions: {system_prompt}\n\n"
        "Stay in character. Respond conversationally and move the interaction forward.\n"
        "If this is a job interview, ask relevant follow-up questions based on the user's answers.\n"
        "Use the previous user answers to avoid repeating questions and to ask sharper follow-ups.\n"
        "Use the recent conversation context to stay coherent and realistic.\n"
        "Keep the vocabulary and phrasing natural for the selected language.\n"
        "Keep responses concise, natural, and useful for spoken practice.\n"
        "Adapt the conversation to the learner profile instead of using a fixed script.\n"
        "Prefer one strong response over multiple unrelated questions.\n\n"
        f"Correction style:\n{correction_profile}\n\n"
        f"Adaptive coaching profile:\n{adaptation_profile}\n\n"
        f"Repeated mistakes to target gently:\n{mistakes}\n\n"
        f"Recent conversation context:\n{recent_context}\n\n"
        f"Previous user answers:\n{previous_answers}"
    )


def build_adaptation_profile(
    *,
    current_level: str | None,
    scenario_difficulty: str,
    weakest_skill: str,
) -> str:
    level = current_level or "A2"
    presets = {
        "A1": "Use short direct questions, simple vocabulary, very light correction, and short follow-ups.",
        "A2": "Use simple-to-moderate vocabulary, one focused follow-up, and gentle corrections when needed.",
        "B1": "Use moderate vocabulary, moderate answer depth, and coaching follow-ups that push for clearer detail.",
        "B2": "Use more professional vocabulary, deeper follow-up questions, and moderate correction strictness.",
        "C1": "Use advanced questioning, nuanced vocabulary, and sharper follow-ups that test explanation quality.",
        "C2": "Use high-level nuanced prompts, advanced vocabulary, and demanding follow-up depth.",
    }
    weakness_guidance = {
        "grammar_accuracy": "Prefer prompts that expose tense and sentence control, and gently reform weak grammar in your next reply.",
        "fluency": "Prefer prompts that encourage smoother longer answers instead of abrupt one-line responses.",
        "sentence_complexity": "Ask for reasons, contrasts, and examples so the learner produces richer sentence structures.",
        "answer_completeness": "Push the learner to give fuller answers with context, action, and outcome.",
        "confidence": "Keep an encouraging tone, reduce pressure slightly, and avoid overly difficult multi-part questions.",
        "word_diversity": "Invite more specific vocabulary and discourage repeating the same basic words.",
        "advanced_vocabulary": "Model slightly stronger vocabulary and ask the learner to explain ideas more precisely.",
        "vocabulary_diversity": "Invite more specific vocabulary and discourage repeating the same basic words.",
    }
    return (
        f"Base scenario difficulty: {scenario_difficulty}\n"
        f"Target CEFR adaptation: {level}\n"
        f"Question complexity, speaking difficulty, correction strictness, vocabulary level, and follow-up depth should match this level.\n"
        f"Main learner weakness: {weakest_skill}\n"
        f"Level behavior: {presets.get(level, presets['A2'])}\n"
        f"Weakness behavior: {weakness_guidance.get(weakest_skill, 'Keep the session adaptive and focused.')}"
    )


def build_mistake_memory(mistake_memory: Sequence[dict[str, str | None]]) -> str:
    if not mistake_memory:
        return "No repeated mistakes recorded yet."

    lines = []
    for item in mistake_memory:
        lines.append(
            f"- {item.get('mistake_type', 'unknown')}: hint={item.get('hint') or 'n/a'}; correction={item.get('correction') or 'n/a'}"
        )
    return "\n".join(lines)


def build_correction_profile(correction_mode: str) -> str:
    mode = (correction_mode or "delayed").lower()
    if mode == "no_interruption":
        return "Do not correct during the conversation. Save corrections for the end only."
    if mode == "correct_every_answer":
        return "After each user reply, add brief corrections and a better version."
    if mode == "major_mistakes_only":
        return "Only correct major mistakes that block understanding. Ignore minor issues."
    if mode == "delayed":
        return "Focus on the conversation. Provide a short correction summary after every 2 to 3 turns."
    return "Use delayed correction unless instructed otherwise."
