"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";

type Message = {
  id: number;
  conversation_id: number;
  sender_role: string;
  content: string;
  created_at: string;
};

type Conversation = {
  id: number;
  user_id: number;
  scenario_id: number;
  language: "English" | "Spanish" | "French" | "German";
  status: string;
  messages: Message[];
};

type RubricResponse = {
  overall_score: number;
  scores: Record<string, number>;
  action_items: string[];
  question: string | null;
};

type GrammarMatch = {
  message: string;
  short_message: string;
  offset: number;
  length: number;
  sentence: string;
  replacements: string[];
  rule_id: string;
  category: string;
};

type GrammarResponse = {
  text: string;
  match_count: number;
  matches: GrammarMatch[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreTone(value: number) {
  if (value >= 80) return "border-emerald-300/20 bg-emerald-400/10";
  if (value >= 60) return "border-cyan-300/20 bg-cyan-400/10";
  return "border-rose-300/20 bg-rose-500/10";
}

export default function ReplayPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [token, setToken] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);

  const [rubrics, setRubrics] = useState<Record<number, RubricResponse>>({});
  const [rubricLoadingId, setRubricLoadingId] = useState<number | null>(null);
  const [grammar, setGrammar] = useState<Record<number, GrammarResponse>>({});
  const [grammarLoadingId, setGrammarLoadingId] = useState<number | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token") ?? "";
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) return;

    async function loadConversation() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/conversations/${params.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await readApiData<Conversation>(response);
        setConversation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load replay.");
      } finally {
        setLoading(false);
      }
    }

    void loadConversation();
  }, [params.id, token]);

  async function playVoice(message: Message) {
    setError("");
    setSpeakingMessageId(message.id);

    try {
      const response = await fetch(`${API_BASE_URL}/speech/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content }),
      });
      if (!response.ok) throw new Error("Voice playback failed.");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (currentAudioRef.current) currentAudioRef.current.pause();
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(audioUrl);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        setSpeakingMessageId((id) => (id === message.id ? null : id));
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(audioUrl);
        setSpeakingMessageId(null);
        setError("Voice playback failed.");
      });

      await audio.play();
    } catch (err) {
      setSpeakingMessageId(null);
      setError(err instanceof Error ? err.message : "Voice playback failed.");
    }
  }

  async function scoreMessage(messageId: number) {
    if (!token) return;
    setError("");
    setRubricLoadingId(messageId);

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/rubric`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message_id: messageId }),
      });
      const data = await readApiData<RubricResponse>(response);
      setRubrics((prev) => ({ ...prev, [messageId]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rubric scoring failed.");
    } finally {
      setRubricLoadingId(null);
    }
  }

  async function loadCorrections(messageId: number) {
    if (!token) return;
    setError("");
    setGrammarLoadingId(messageId);

    try {
      const response = await fetch(`${API_BASE_URL}/analysis/grammar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message_id: messageId }),
      });
      const data = await readApiData<GrammarResponse>(response);
      setGrammar((prev) => ({ ...prev, [messageId]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Corrections failed.");
    } finally {
      setGrammarLoadingId(null);
    }
  }

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="glass-panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
            Session replay
          </p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="display text-4xl font-semibold text-white md:text-6xl">
                Conversation #{params.id}
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Replay transcript, generate voice playback, inspect corrections, and
                flag weak moments.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                href={`/chat/${params.id}`}
              >
                Open chat
              </Link>
              <Link
                className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                href="/dashboard"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <div className="glass-panel rounded-[2rem] p-6">
            <p className="rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="glass-panel rounded-[2rem] p-6">
            <p className="text-sm text-slate-400">Loading session...</p>
          </div>
        ) : null}

        {conversation ? (
          <section className="glass-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  Scenario
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  #{conversation.scenario_id} • {conversation.language} •{" "}
                  {conversation.status}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                {conversation.messages.length} messages
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {conversation.messages.map((message) => {
                const rubric = rubrics[message.id] ?? null;
                const corrections = grammar[message.id] ?? null;
                const weak = rubric ? rubric.overall_score < 60 : false;
                const wrapperStyle =
                  message.sender_role === "user"
                    ? "ml-auto border-cyan-200/25 bg-[linear-gradient(135deg,rgba(105,226,255,0.92),rgba(167,243,208,0.76))] text-slate-950"
                    : "border-white/10 bg-[rgba(7,16,29,0.86)] text-slate-100";
                const weakStyle =
                  weak && message.sender_role === "user"
                    ? "ring-1 ring-rose-300/50"
                    : "";

                return (
                  <div
                    key={message.id}
                    className={`max-w-[90%] rounded-[1.6rem] border px-4 py-4 text-sm leading-7 shadow-xl ${wrapperStyle} ${weakStyle}`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">
                          {message.sender_role === "user" ? "You" : "AI coach"}
                        </p>
                        <p className="mt-1 text-[11px] opacity-55">
                          {formatTimestamp(message.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] opacity-90 transition hover:border-cyan-300/50"
                          type="button"
                          onClick={() => void playVoice(message)}
                        >
                          {speakingMessageId === message.id ? "Playing" : "Replay voice"}
                        </button>
                        {message.sender_role === "user" ? (
                          <>
                            <button
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] opacity-90 transition hover:border-cyan-300/50 disabled:opacity-60"
                              type="button"
                              disabled={rubricLoadingId === message.id}
                              onClick={() => void scoreMessage(message.id)}
                            >
                              {rubricLoadingId === message.id
                                ? "Scoring..."
                                : "Inspect weak moment"}
                            </button>
                            <button
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] opacity-90 transition hover:border-cyan-300/50 disabled:opacity-60"
                              type="button"
                              disabled={grammarLoadingId === message.id}
                              onClick={() => void loadCorrections(message.id)}
                            >
                              {grammarLoadingId === message.id
                                ? "Checking..."
                                : "Inspect corrections"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {rubric ? (
                      <div
                        className={`mt-4 rounded-[1.25rem] border p-4 text-sm ${scoreTone(
                          rubric.overall_score,
                        )}`}
                      >
                        <p className="text-[11px] uppercase tracking-[0.22em] opacity-75">
                          Rubric overall: {rubric.overall_score.toFixed(1)}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {Object.entries(rubric.scores).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between rounded-[1.1rem] border border-white/10 bg-white/5 px-3 py-2 text-xs"
                            >
                              <span className="capitalize">{key}</span>
                              <span className="font-semibold">{value.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 space-y-1 text-xs opacity-90">
                          {rubric.action_items.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {corrections ? (
                      <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">
                          Corrections ({corrections.match_count})
                        </p>
                        <div className="mt-3 space-y-2">
                          {corrections.matches.slice(0, 4).map((match) => (
                            <div
                              key={`${match.rule_id}-${match.offset}`}
                              className="rounded-[1.1rem] border border-white/10 bg-slate-950/35 p-3"
                            >
                              <p className="text-xs text-slate-200">{match.message}</p>
                              {match.replacements.length ? (
                                <p className="mt-1 text-xs text-slate-400">
                                  Suggestion: {match.replacements.slice(0, 3).join(", ")}
                                </p>
                              ) : null}
                            </div>
                          ))}
                          {corrections.match_count > 4 ? (
                            <p className="text-xs text-slate-400">
                              Showing top 4. Run full grammar analysis for details.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

