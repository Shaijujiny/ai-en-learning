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
) -> str:
    recent_context = build_recent_context(conversation_history)
    previous_answers = build_previous_answers(conversation_history)
    return (
        f"You are running the scenario: {scenario_title}.\n"
        f"Scenario description: {scenario_description}\n"
        f"Difficulty: {scenario_difficulty}\n"
        f"Respond in this language: {target_language}\n"
        f"Primary instructions: {system_prompt}\n\n"
        "Stay in character. Respond conversationally and move the interaction forward.\n"
        "If this is a job interview, ask relevant follow-up questions based on the user's answers.\n"
        "Use the previous user answers to avoid repeating questions and to ask sharper follow-ups.\n"
        "Use the recent conversation context to stay coherent and realistic.\n"
        "Keep the vocabulary and phrasing natural for the selected language.\n"
        "Keep responses concise, natural, and useful for spoken practice.\n"
        "Prefer one strong response over multiple unrelated questions.\n\n"
        f"Recent conversation context:\n{recent_context}\n\n"
        f"Previous user answers:\n{previous_answers}"
    )
