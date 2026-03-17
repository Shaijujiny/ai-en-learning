"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";
import { BackButton } from "@/components/BackButton";

/* ═══════════════════════════════════════════════════════════
   MISTAKE REPLAY — replay bad answers & fix them
   ═══════════════════════════════════════════════════════════ */

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
  custom_title: string | null;
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

type RewriteResponse = {
  original: string;
  rewritten: string;
  explanation: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scoreColor(v: number) {
  if (v >= 75) return "text-emerald-300";
  if (v >= 55) return "text-amber-300";
  return "text-rose-300";
}

function scoreBorder(v: number) {
  if (v >= 75) return "border-emerald-300/20 bg-emerald-500/8";
  if (v >= 55) return "border-amber-300/20 bg-amber-500/8";
  return "border-rose-300/20 bg-rose-500/8";
}

/* ─── Inline "Fix it" practice modal ─── */
function FixItPanel({
  original,
  rewrite,
  onClose,
}: {
  original: string;
  rewrite: RewriteResponse | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[2rem] border border-white/15 bg-slate-950 p-6 mb-4 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "slideUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="ds-label ds-label-primary">🔁 Fix This Answer</p>
          <button className="text-xs text-slate-500 hover:text-white" onClick={onClose} type="button">✕</button>
        </div>

        {/* Original */}
        <div className="rounded-[1.3rem] border border-rose-300/20 bg-rose-500/8 px-4 py-3 mb-3">
          <p className="text-[10px] uppercase tracking-wider text-rose-400 mb-1.5">❌ Your answer</p>
          <p className="text-sm text-rose-100 leading-6">{original}</p>
        </div>

        {rewrite ? (
          <>
            {/* Improved version */}
            <div className="rounded-[1.3rem] border border-emerald-300/20 bg-emerald-500/8 px-4 py-3 mb-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1.5">✅ Better version</p>
              <p className="text-sm text-emerald-100 leading-6">{rewrite.rewritten}</p>
            </div>

            {/* Explanation */}
            {rewrite.explanation && (
              <div className="rounded-[1.3rem] border border-white/8 bg-white/4 px-4 py-3 mb-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">💡 Why it&apos;s better</p>
                <p className="text-xs text-slate-300 leading-5">{rewrite.explanation}</p>
              </div>
            )}

            <p className="text-xs text-slate-500 text-center">
              Read the better version aloud 3 times to build muscle memory.
            </p>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
            <span className="ds-btn-spinner" /> Generating correction…
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReplayPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [token, setToken] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* Analysis state per message id */
  const [rubrics, setRubrics] = useState<Record<number, RubricResponse>>({});
  const [rubricLoading, setRubricLoading] = useState<number | null>(null);
  const [grammar, setGrammar] = useState<Record<number, GrammarResponse>>({});
  const [grammarLoading, setGrammarLoading] = useState<number | null>(null);
  const [rewrites, setRewrites] = useState<Record<number, RewriteResponse>>({});

  /* Fix-it modal */
  const [fixItMessage, setFixItMessage] = useState<Message | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);

  /* Audio */
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* Tab */
  const [view, setView] = useState<"all" | "weak">("all");

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE_URL}/conversations/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<Conversation>(res);
        setConversation(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load replay.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id, token]);

  const playVoice = useCallback(async (message: Message) => {
    setSpeakingId(message.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/speech/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: message.content }),
      });
      if (!res.ok) throw new Error("Playback failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => { URL.revokeObjectURL(url); setSpeakingId(null); });
      audio.addEventListener("error", () => { setSpeakingId(null); });
      await audio.play();
    } catch {
      setSpeakingId(null);
    }
  }, [token]);

  async function scoreMessage(messageId: number) {
    if (!token || rubricLoading) return;
    setRubricLoading(messageId);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/rubric`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: messageId }),
      });
      const data = await readApiData<RubricResponse>(res);
      setRubrics((p) => ({ ...p, [messageId]: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed.");
    } finally {
      setRubricLoading(null);
    }
  }

  async function loadGrammar(messageId: number) {
    if (!token || grammarLoading) return;
    setGrammarLoading(messageId);
    try {
      const res = await fetch(`${API_BASE_URL}/analysis/grammar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: messageId }),
      });
      const data = await readApiData<GrammarResponse>(res);
      setGrammar((p) => ({ ...p, [messageId]: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grammar check failed.");
    } finally {
      setGrammarLoading(null);
    }
  }

  async function openFixIt(message: Message) {
    setFixItMessage(message);
    if (rewrites[message.id]) return; // already loaded
    setRewriteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: message.id }),
      });
      const data = await readApiData<RewriteResponse>(res);
      setRewrites((p) => ({ ...p, [message.id]: data }));
    } catch {
      // non-critical
    } finally {
      setRewriteLoading(false);
    }
  }

  const userMessages = conversation?.messages.filter((m) => m.sender_role === "user") ?? [];
  const weakMessages = userMessages.filter((m) => rubrics[m.id] && rubrics[m.id].overall_score < 60);

  const displayMessages = view === "weak"
    ? (weakMessages.length > 0 ? weakMessages : userMessages)
    : conversation?.messages ?? [];

  const weakCount = weakMessages.length;

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        .anim { animation: fadeUp 0.4s ease both; }
      `}</style>

      {/* Fix-it modal */}
      {fixItMessage && (
        <FixItPanel
          original={fixItMessage.content}
          rewrite={rewriteLoading ? null : (rewrites[fixItMessage.id] ?? null)}
          onClose={() => setFixItMessage(null)}
        />
      )}

      <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-6">
        <section className="mx-auto max-w-3xl flex flex-col gap-5">

          {/* Header */}
          <div className="anim glass-panel rounded-[2rem] p-6">
            <p className="ds-label ds-label-primary mb-2">🔁 Mistake Replay</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="display text-2xl font-bold text-white md:text-3xl">
                  {conversation?.custom_title ?? `Conversation #${params.id}`}
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  {conversation ? `${conversation.messages.length} messages · ${conversation.language} · ${conversation.status}` : "Loading…"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <BackButton fallbackHref="/dashboard" label="Dashboard" />
                <Link href={`/chat/${params.id}`} className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-pill">
                  Continue chat
                </Link>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="ds-card-danger rounded-[2rem] px-5 py-4 text-sm flex items-center justify-between gap-3">
              <span>❌ {error}</span>
              <button className="text-xs opacity-60 hover:opacity-100" onClick={() => setError("")} type="button">✕</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="glass-panel rounded-[2rem] p-6">
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[1.5rem] bg-white/5" />)}
              </div>
            </div>
          )}

          {conversation && (
            <>
              {/* Stats + controls */}
              <div className="anim grid grid-cols-3 gap-3">
                <div className="ds-card-flat rounded-[1.5rem] text-center">
                  <p className="text-2xl font-black text-white">{userMessages.length}</p>
                  <p className="ds-label mt-1">Your answers</p>
                </div>
                <div className={`rounded-[1.5rem] border text-center p-4 ${weakCount > 0 ? "border-rose-300/20 bg-rose-500/8" : "ds-card-flat"}`}>
                  <p className={`text-2xl font-black ${weakCount > 0 ? "text-rose-300" : "text-white"}`}>
                    {Object.keys(rubrics).length > 0 ? weakCount : "?"}
                  </p>
                  <p className="ds-label mt-1">Weak answers</p>
                </div>
                <div className="ds-card-flat rounded-[1.5rem] text-center">
                  <p className={`text-2xl font-black ${scoreColor(
                    Object.values(rubrics).length > 0
                      ? Object.values(rubrics).reduce((s, r) => s + r.overall_score, 0) / Object.values(rubrics).length
                      : 0
                  )}`}>
                    {Object.values(rubrics).length > 0
                      ? Math.round(Object.values(rubrics).reduce((s, r) => s + r.overall_score, 0) / Object.values(rubrics).length)
                      : "—"}
                  </p>
                  <p className="ds-label mt-1">Avg score</p>
                </div>
              </div>

              {/* View tabs + score-all button */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="ds-tab-bar">
                  <button className={`ds-tab ${view === "all" ? "ds-tab-active" : ""}`} onClick={() => setView("all")} type="button">
                    All messages
                  </button>
                  <button className={`ds-tab ${view === "weak" ? "ds-tab-active" : ""}`} onClick={() => setView("weak")} type="button">
                    🔴 Weak only {weakCount > 0 && `(${weakCount})`}
                  </button>
                </div>
                <button
                  className="ds-btn ds-btn-warning ds-btn-sm ds-btn-pill"
                  onClick={async () => {
                    for (const m of userMessages) {
                      if (!rubrics[m.id]) await scoreMessage(m.id);
                    }
                  }}
                  disabled={rubricLoading !== null}
                  type="button"
                >
                  {rubricLoading !== null ? <span className="ds-btn-spinner" /> : "⚡ Score all answers"}
                </button>
              </div>

              {/* Messages */}
              <div className="space-y-4">
                {displayMessages.map((msg, i) => {
                  const isUser = msg.sender_role === "user";
                  const rubric = rubrics[msg.id] ?? null;
                  const gram = grammar[msg.id] ?? null;
                  const isWeak = rubric ? rubric.overall_score < 60 : false;

                  return (
                    <div
                      key={msg.id}
                      className={`rounded-[1.75rem] border overflow-hidden ${
                        isUser
                          ? isWeak
                            ? "border-rose-300/25 bg-rose-500/5"
                            : "border-cyan-300/20 bg-cyan-500/5"
                          : "border-white/8 bg-white/3"
                      }`}
                      style={{ animation: `fadeUp 0.35s ease ${i * 0.04}s both` }}
                    >
                      {/* Message header */}
                      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`ds-avatar ds-avatar-sm ${isUser ? "ds-avatar-primary" : "ds-avatar-neutral"}`}>
                            {isUser ? "U" : "AI"}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">{isUser ? "You" : "AI Coach"}</p>
                            <p className="text-[10px] text-slate-600">{formatTime(msg.created_at)}</p>
                          </div>
                          {rubric && (
                            <span className={`ds-tag ${isWeak ? "ds-tag-danger" : rubric.overall_score >= 75 ? "ds-tag-accent" : "ds-tag-warning"}`}>
                              {Math.round(rubric.overall_score)}/100
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            className="ds-btn ds-btn-ghost ds-btn-xs ds-btn-pill"
                            onClick={() => void playVoice(msg)}
                            type="button"
                          >
                            {speakingId === msg.id ? "🔊 Playing…" : "▶ Listen"}
                          </button>
                          {isUser && (
                            <>
                              <button
                                className="ds-btn ds-btn-ghost ds-btn-xs ds-btn-pill"
                                onClick={() => void scoreMessage(msg.id)}
                                disabled={rubricLoading === msg.id}
                                type="button"
                              >
                                {rubricLoading === msg.id ? <span className="ds-btn-spinner" /> : "📊 Score"}
                              </button>
                              <button
                                className="ds-btn ds-btn-ghost ds-btn-xs ds-btn-pill"
                                onClick={() => void loadGrammar(msg.id)}
                                disabled={grammarLoading === msg.id}
                                type="button"
                              >
                                {grammarLoading === msg.id ? <span className="ds-btn-spinner" /> : "📐 Grammar"}
                              </button>
                              <button
                                className="ds-btn ds-btn-warning ds-btn-xs ds-btn-pill"
                                onClick={() => void openFixIt(msg)}
                                type="button"
                              >
                                🔁 Fix it
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Message body */}
                      <div className="px-5 pb-4">
                        <p className="text-sm text-slate-200 leading-7 whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Rubric breakdown */}
                      {rubric && (
                        <div className={`mx-4 mb-4 rounded-[1.4rem] border p-4 ${scoreBorder(rubric.overall_score)}`}>
                          <div className="grid gap-2 sm:grid-cols-3 mb-3">
                            {Object.entries(rubric.scores).slice(0, 6).map(([key, value]) => (
                              <div key={key} className="rounded-[1rem] border border-white/8 bg-white/5 px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-xs text-slate-400 capitalize">{key.replaceAll("_", " ")}</span>
                                <span className={`text-xs font-bold ${scoreColor(value)}`}>{Math.round(value)}</span>
                              </div>
                            ))}
                          </div>
                          {rubric.action_items.length > 0 && (
                            <div className="space-y-1">
                              {rubric.action_items.slice(0, 2).map((a) => (
                                <p key={a} className="text-xs text-slate-400 flex items-start gap-2">
                                  <span className="text-amber-400 flex-shrink-0 mt-0.5">→</span>{a}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Grammar corrections */}
                      {gram && gram.match_count > 0 && (
                        <div className="mx-4 mb-4 rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
                          <p className="ds-label mb-3">📐 {gram.match_count} grammar {gram.match_count === 1 ? "issue" : "issues"}</p>
                          <div className="space-y-2.5">
                            {gram.matches.slice(0, 3).map((m) => (
                              <div key={`${m.rule_id}-${m.offset}`} className="rounded-[1rem] border border-white/8 bg-white/4 p-3">
                                <p className="text-xs text-white mb-1">{m.short_message || m.message}</p>
                                {m.replacements.length > 0 && (
                                  <p className="text-xs text-emerald-300">
                                    → Try: <span className="font-semibold">{m.replacements.slice(0, 3).join(", ")}</span>
                                  </p>
                                )}
                              </div>
                            ))}
                            {gram.match_count > 3 && (
                              <p className="text-xs text-slate-500">+{gram.match_count - 3} more issues. Click Grammar to see all.</p>
                            )}
                          </div>
                        </div>
                      )}
                      {gram && gram.match_count === 0 && (
                        <div className="mx-4 mb-4 rounded-[1.4rem] border border-emerald-300/15 bg-emerald-500/8 px-4 py-2.5">
                          <p className="text-xs text-emerald-300">✓ No grammar issues found</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {view === "weak" && weakCount === 0 && Object.keys(rubrics).length > 0 && (
                <div className="ds-card-accent rounded-[2rem] text-center py-8">
                  <p className="text-3xl mb-2">🌟</p>
                  <p className="text-base font-bold text-white">No weak answers scored!</p>
                  <p className="text-xs text-slate-400 mt-1">All your answers scored 60+. Great job.</p>
                </div>
              )}

              {view === "weak" && Object.keys(rubrics).length === 0 && (
                <div className="ds-card-flat rounded-[2rem] text-center py-8">
                  <p className="text-sm text-slate-400">Score your answers first to filter weak moments.</p>
                  <button
                    className="ds-btn ds-btn-warning ds-btn-pill mt-4"
                    onClick={async () => {
                      for (const m of userMessages) {
                        if (!rubrics[m.id]) await scoreMessage(m.id);
                      }
                    }}
                    disabled={rubricLoading !== null}
                    type="button"
                  >
                    ⚡ Score all answers
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
