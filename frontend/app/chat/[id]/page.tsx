"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";

/* ─── Types ─── */
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
  text: string;
  question: string | null;
  overall_score: number;
  scores: Record<string, number>;
  action_items: string[];
  notes: Record<string, string>;
};

type CoachFeedback = {
  text: string;
  grammar_match_count: number;
  fluency_score: number;
  vocabulary_score: number;
  summary: string;
  grammar_suggestions: string[];
  interview_answer_suggestions: string[];
};

/* ─── Voice options ─── */
type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const VOICE_OPTIONS: { id: VoiceId; label: string; gender: string; style: string; icon: string }[] = [
  { id: "nova", label: "Nova", gender: "Female", style: "Warm & clear", icon: "👩" },
  { id: "shimmer", label: "Shimmer", gender: "Female", style: "Soft & gentle", icon: "🌸" },
  { id: "alloy", label: "Alloy", gender: "Neutral", style: "Balanced", icon: "🤖" },
  { id: "echo", label: "Echo", gender: "Male", style: "Natural", icon: "👨" },
  { id: "fable", label: "Fable", gender: "Male", style: "British accent", icon: "🎩" },
  { id: "onyx", label: "Onyx", gender: "Male", style: "Deep & confident", icon: "🎙️" },
];

/* ─── Coach personality modes ─── */
type CoachMode = "friendly" | "strict" | "casual";

const COACH_MODES: Record<CoachMode, { label: string; icon: string; desc: string; color: string; borderColor: string; avatarGrad: string }> = {
  friendly: {
    label: "Friendly Teacher",
    icon: "🌟",
    desc: "Warm, encouraging, detailed explanations",
    color: "text-emerald-200",
    borderColor: "border-emerald-300/25",
    avatarGrad: "bg-[linear-gradient(135deg,#34d399,#6ee7b7)]",
  },
  strict: {
    label: "Strict Interviewer",
    icon: "💼",
    desc: "Professional, direct, no easy passes",
    color: "text-violet-200",
    borderColor: "border-violet-300/25",
    avatarGrad: "bg-[linear-gradient(135deg,#8b5cf6,#a78bfa)]",
  },
  casual: {
    label: "Casual Friend",
    icon: "😎",
    desc: "Relaxed, encouraging, conversational",
    color: "text-amber-200",
    borderColor: "border-amber-300/25",
    avatarGrad: "bg-[linear-gradient(135deg,#fbbf24,#fcd34d)]",
  },
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator({ mode }: { mode: CoachMode }) {
  const m = COACH_MODES[mode];
  return (
    <div className="flex items-end gap-3 max-w-[90%] sm:max-w-[85%] md:max-w-[80%]">
      <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${m.avatarGrad} text-slate-950 text-xs font-bold shadow-lg`}>
        {m.icon}
      </div>
      <div className="rounded-[1.6rem] rounded-bl-sm border border-white/10 bg-[rgba(7,16,29,0.9)] px-5 py-4">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 rounded-full bg-slate-400"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Voice waveform ─── */
function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex items-end gap-[3px] h-4">
      {[3, 5, 7, 5, 3, 6, 4].map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-rose-400"
          style={{ height: `${h * 2}px`, animation: active ? `waveBar 0.7s ease-in-out ${i * 0.08}s infinite alternate` : "none", opacity: active ? 1 : 0.3 }} />
      ))}
    </span>
  );
}

/* ─── Live Coaching Feedback Card ─── */
function CoachFeedbackCard({
  feedback,
  mode,
  onDismiss,
  onApplyBetter,
}: {
  feedback: CoachFeedback;
  mode: CoachMode;
  onDismiss: () => void;
  onApplyBetter: (text: string) => void;
}) {
  const m = COACH_MODES[mode];
  const overallGood = feedback.fluency_score >= 65 && feedback.grammar_match_count <= 2;

  // Parse grammar suggestions into "what's wrong" + "better version"
  const goodPoints: string[] = [];
  const improvements: string[] = [];
  const betterVersions: string[] = [];

  // Fluency signal → good/improve
  if (feedback.fluency_score >= 70) {
    goodPoints.push("Good flow and sentence length");
  } else if (feedback.fluency_score < 50) {
    improvements.push("Try writing longer, connected sentences");
  }

  // Vocabulary signal
  if (feedback.vocabulary_score >= 70) {
    goodPoints.push("Nice vocabulary variety");
  } else {
    improvements.push("Use more varied word choices");
  }

  // Grammar
  if (feedback.grammar_match_count === 0) {
    goodPoints.push("No grammar issues detected");
  } else {
    improvements.push(...feedback.grammar_suggestions.slice(0, 2));
  }

  // Better versions from interview suggestions
  betterVersions.push(...feedback.interview_answer_suggestions.slice(0, 2));

  return (
    <div className={`rounded-[1.75rem] border ${m.borderColor} bg-slate-950/70 backdrop-blur-sm overflow-hidden`}
      style={{ animation: "slideUp 0.35s cubic-bezier(0.22,1,0.36,1) both" }}>

      {/* Header */}
      <div className={`flex items-center justify-between border-b border-white/8 px-5 py-3`}>
        <div className="flex items-center gap-2.5">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${m.avatarGrad} text-sm`}>{m.icon}</span>
          <div>
            <p className="text-xs font-semibold text-white">{m.label} Feedback</p>
            <p className={`text-[10px] ${m.color}`}>{feedback.fluency_score >= 60 ? "Good response" : "Room to improve"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Score pill */}
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${overallGood ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-200" : "border-amber-300/30 bg-amber-500/15 text-amber-200"
            }`}>
            {Math.round((feedback.fluency_score + feedback.vocabulary_score) / 2)}/100
          </span>
          <button className="rounded-full p-1.5 text-slate-500 hover:text-white transition" onClick={onDismiss} type="button">✕</button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Summary */}
        {feedback.summary && (
          <p className="text-sm text-slate-300 leading-6 italic border-l-2 border-cyan-400/30 pl-3">
            &ldquo;{feedback.summary}&rdquo;
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* ✅ What was good */}
          {goodPoints.length > 0 && (
            <div className="rounded-[1.3rem] border border-emerald-300/15 bg-emerald-500/8 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-semibold mb-2.5">👍 Good</p>
              <div className="space-y-1.5">
                {goodPoints.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-emerald-100">
                    <span className="mt-0.5 flex-shrink-0 text-emerald-400">✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ⚠️ Improve */}
          {improvements.length > 0 && (
            <div className="rounded-[1.3rem] border border-amber-300/15 bg-amber-500/8 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-semibold mb-2.5">⚠ Improve</p>
              <div className="space-y-1.5">
                {improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-100">
                    <span className="mt-0.5 flex-shrink-0 text-amber-400">→</span>
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 💡 Better versions */}
        {betterVersions.length > 0 && (
          <div className="rounded-[1.3rem] border border-cyan-300/15 bg-cyan-500/8 p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-semibold mb-2.5">💡 Better version</p>
            <div className="space-y-3">
              {betterVersions.map((bv, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <p className="text-xs text-cyan-100 leading-5 italic flex-1">&ldquo;{bv}&rdquo;</p>
                  <button
                    className="flex-shrink-0 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[10px] text-cyan-200 hover:bg-cyan-500/20 transition"
                    onClick={() => onApplyBetter(bv)}
                    type="button"
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score breakdown mini */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Fluency", val: feedback.fluency_score, color: "bg-cyan-400" },
            { label: "Vocabulary", val: feedback.vocabulary_score, color: "bg-violet-400" },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-[1rem] border border-white/8 bg-white/4 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">{label}</span>
                <span className="text-[10px] font-bold text-white">{Math.round(val)}</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(val, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const REACTIONS = ["👍", "❤️", "💡", "🤔"];

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const [token, setToken] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [rubric, setRubric] = useState<RubricResponse | null>(null);
  const [scoring, setScoring] = useState(false);
  const [rewritingMode, setRewritingMode] = useState<string | null>(null);
  const [credits, setCredits] = useState<{
    remaining: number;
    total: number;
    messages_today: number;
    messages_until_next_deduction: number;
  } | null>(null);
  const creditsRemaining = credits?.remaining ?? 20;
  const creditsTotal = credits?.total ?? 20;
  const msgsUntilNext = credits?.messages_until_next_deduction ?? 5;
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [showReactionFor, setShowReactionFor] = useState<number | null>(null);

  /* ─── Voice state ─── */
  const [voiceId, setVoiceId] = useState<VoiceId>("nova");
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  /* ─── Coach state ─── */
  const [coachMode, setCoachMode] = useState<CoachMode>("friendly");
  const [showModePanel, setShowModePanel] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<CoachFeedback | null>(null);
  const [fetchingCoach, setFetchingCoach] = useState(false);
  const [lastCoachMessageId, setLastCoachMessageId] = useState<number | null>(null);
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [showCreditsInfo, setShowCreditsInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, sending]);

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/credits`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d?.data) setCredits(d.data); })
      .catch(() => { });
  }, [token]);

  async function refreshCredits() {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE_URL}/credits`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d?.data) setCredits(d.data);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!token) return;
    async function load() {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE_URL}/conversations/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      try {
        const data = await readApiData<Conversation>(res);
        setConversation(data);
      } catch {
        setError("Could not load your conversation. Try again.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id, token]);

  /* ─── Fetch coaching feedback for a user message ─── */
  async function fetchCoachFeedback(userText: string, msgId: number) {
    if (!coachEnabled || !token || fetchingCoach) return;
    if (lastCoachMessageId === msgId) return;
    setFetchingCoach(true);
    setCoachFeedback(null);
    setLastCoachMessageId(msgId);
    try {
      const res = await fetch(`${API_BASE_URL}/coaching/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: userText }),
      });
      const data = await readApiData<{ data: CoachFeedback }>(res);
      // Handle both wrapped and unwrapped responses
      const fb = (data as unknown as { data: CoachFeedback }).data ?? (data as unknown as CoachFeedback);
      setCoachFeedback(fb);
    } catch {
      // Silent fail — coaching is non-critical
    } finally {
      setFetchingCoach(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || !token || !conversation) return;

    const sentText = message;
    setSending(true);
    setError("");
    setCoachFeedback(null);
    setRubric(null);

    try {
      const res = await fetch(`${API_BASE_URL}/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: conversation.id, content: sentText, coach_mode: coachEnabled ? coachMode : null }),
      });
      const data = await readApiData<{ user_message: Message; ai_message: Message }>(res);
      setConversation({ ...conversation, messages: [...conversation.messages, data.user_message, data.ai_message] });
      setMessage("");
      void playAiReply(data.ai_message);
      void refreshCredits();
      setTimeout(() => inputRef.current?.focus(), 100);
      // Trigger coaching feedback after sending
      void fetchCoachFeedback(sentText, data.user_message.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) { setError("Microphone not supported."); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); });
      recorder.addEventListener("stop", () => void transcribeRecording());
      recorder.start();
      setRecording(true);
    } catch { setError("Could not access microphone."); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setRecording(false);
  }

  async function transcribeRecording() {
    if (audioChunksRef.current.length === 0) return;
    setTranscribing(true);
    setError("");
    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const lang = conversation?.language === "Spanish" ? "es" : conversation?.language === "French" ? "fr" : conversation?.language === "German" ? "de" : "en";
      form.append("language", lang);
      form.append("prompt", "English conversation practice");
      const res = await fetch(`${API_BASE_URL}/speech/transcribe`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = await readApiData<{ text: string }>(res);
      setMessage((m) => m ? `${m.trim()} ${data.text}`.trim() : data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice transcription failed.");
    } finally {
      audioChunksRef.current = [];
      setTranscribing(false);
    }
  }

  async function rewriteDraft(mode: string) {
    if (!token || !message.trim() || !conversation || !!error) return;
    setError("");
    setRewritingMode(mode);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: message, mode }),
      });
      const data = await readApiData<{ mode: string; rewritten_text: string }>(res);
      setMessage(data.rewritten_text);
      void refreshCredits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rewrite failed.");
    } finally {
      setRewritingMode(null);
    }
  }

  async function scoreDraft() {
    if (!token || !conversation || !message.trim() || !!error) return;
    setError("");
    setScoring(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/rubric`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: message, conversation_id: conversation.id }),
      });
      const data = await readApiData<RubricResponse>(res);
      setRubric(data);
      void refreshCredits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not score your answer.");
    } finally {
      setScoring(false);
    }
  }

  async function playAiReply(aiMessage: Message) {
    setError("");
    setSpeakingMessageId(aiMessage.id);
    try {
      const res = await fetch(`${API_BASE_URL}/speech/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: aiMessage.content, voice: voiceId }),
      });
      if (!res.ok) throw new Error("Playback failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (currentAudioRef.current) currentAudioRef.current.pause();
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        setSpeakingMessageId((id) => id === aiMessage.id ? null : id);
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        setSpeakingMessageId(null);
      });
      await audio.play();
    } catch {
      setSpeakingMessageId(null);
    }
  }

  const canAct = !loading && !!conversation && !error && !!token;
  const currentMode = COACH_MODES[coachMode];

  return (
    <>
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes waveBar { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRing { 0%{box-shadow:0 0 0 0 rgba(105,226,255,0.4)} 70%{box-shadow:0 0 0 8px rgba(105,226,255,0)} 100%{box-shadow:0 0 0 0 rgba(105,226,255,0)} }
      `}</style>

      <main className="app-shell grid-overlay flex h-screen flex-col overflow-hidden text-slate-100">

        {/* ─── Topbar ─── */}
        <header className="flex items-center justify-between border-b border-white/8 px-4 py-3 md:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/portal" className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/50 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-medium text-slate-300 shadow-sm hover:border-cyan-300/30 hover:bg-white/10 hover:text-white transition">
              ← Back
            </Link>
            <div className="hidden sm:block min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{conversation?.language ?? "…"} session</p>
              <p className="text-sm font-medium text-white truncate">{loading ? "Loading…" : `Conversation #${params.id}`}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Coach mode button */}
            <div className="relative">
              <button
                className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold tracking-wide transition shadow-lg ${coachEnabled ? `${currentMode.borderColor} bg-slate-950/50 backdrop-blur-md ${currentMode.color}` : "border-white/10 bg-slate-950/50 backdrop-blur-md text-slate-400"
                  }`}
                onClick={() => setShowModePanel((p) => !p)}
                type="button"
              >
                <span className="text-sm">{currentMode.icon}</span>
                <span className="hidden sm:inline">{currentMode.label}</span>
                <span className="text-slate-500 opacity-80">▾</span>
              </button>

              {/* Coach mode panel */}
              {showModePanel && (
                <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-[1.5rem] border border-white/10 bg-slate-950/95 backdrop-blur-xl p-3 shadow-2xl"
                  style={{ animation: "slideUp 0.2s ease both" }}>
                  <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/8">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Coach Personality</p>
                    <button
                      className={`text-[11px] px-2 py-1 rounded-full border transition ${coachEnabled ? "border-emerald-300/25 text-emerald-300" : "border-white/10 text-slate-500"
                        }`}
                      onClick={() => setCoachEnabled((p) => !p)}
                      type="button"
                    >
                      {coachEnabled ? "On" : "Off"}
                    </button>
                  </div>
                  {(Object.entries(COACH_MODES) as [CoachMode, typeof COACH_MODES[CoachMode]][]).map(([key, m]) => (
                    <button
                      key={key}
                      className={`w-full flex items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-left transition mb-1 ${coachMode === key ? `${m.borderColor} bg-white/8` : "border-transparent hover:bg-white/5"
                        }`}
                      onClick={() => { setCoachMode(key); setShowModePanel(false); }}
                      type="button"
                    >
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${m.avatarGrad} text-slate-950`}>{m.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{m.label}</p>
                        <p className="text-[11px] text-slate-500">{m.desc}</p>
                      </div>
                      {coachMode === key && <span className="ml-auto text-cyan-400 text-sm">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Voice selector */}
            <div className="relative">
              <button
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/50 backdrop-blur-md px-3 py-2 text-[11px] font-semibold text-slate-300 shadow-lg hover:border-cyan-300/30 hover:text-white transition"
                onClick={() => { setShowVoicePanel((p) => !p); setShowModePanel(false); }}
                type="button"
                title="Change AI voice"
              >
                <span>{VOICE_OPTIONS.find((v) => v.id === voiceId)?.icon ?? "🔊"}</span>
                <span className="hidden sm:inline">{VOICE_OPTIONS.find((v) => v.id === voiceId)?.label ?? "Voice"}</span>
                <span className="text-slate-500 opacity-80">▾</span>
              </button>

              {showVoicePanel && (
                <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-[1.5rem] border border-white/10 bg-slate-950/95 backdrop-blur-xl p-3 shadow-2xl"
                  style={{ animation: "slideUp 0.2s ease both" }}>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400 px-2 pb-2 mb-1 border-b border-white/8">AI Voice</p>
                  {VOICE_OPTIONS.map((v) => (
                    <button
                      key={v.id}
                      className={`w-full flex items-center gap-3 rounded-[1.2rem] border px-3 py-2.5 text-left transition mb-1 ${voiceId === v.id ? "border-cyan-300/25 bg-cyan-500/10" : "border-transparent hover:bg-white/5"
                        }`}
                      onClick={() => { setVoiceId(v.id); setShowVoicePanel(false); }}
                      type="button"
                    >
                      <span className="text-xl w-7 text-center">{v.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{v.label}
                          <span className="ml-1.5 text-[10px] font-normal text-slate-500">{v.gender}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">{v.style}</p>
                      </div>
                      {voiceId === v.id && <span className="text-cyan-400 text-sm">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Credits pill + info button */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 backdrop-blur-md px-3 sm:px-4 py-2 shadow-lg">
              <span className="text-xs sm:text-sm -mt-0.5">🔥</span>
              <div className="h-1.5 w-12 sm:w-16 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${creditsRemaining === 0 ? "bg-rose-400" : "bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]"}`}
                  style={{ width: `${(creditsRemaining / creditsTotal) * 100}%` }}
                />
              </div>
              <span className={`text-[10px] sm:text-xs font-bold font-mono tracking-tight ${creditsRemaining === 0 ? "text-rose-300" : "text-slate-300"}`}>
                {creditsRemaining}/{creditsTotal}
              </span>
              {/* Info button — opens modal, never overlaps */}
              <button
                onClick={() => setShowCreditsInfo(true)}
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-[9px] font-bold text-slate-400 hover:border-cyan-300/40 hover:bg-cyan-500/10 hover:text-cyan-300 transition"
                type="button"
                aria-label="How credits work"
              >
                i
              </button>
            </div>

            {/* Status */}
            <div className={`hidden md:flex items-center justify-center rounded-full border px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest shadow-lg ${recording ? "border-rose-300/30 bg-rose-500/10 backdrop-blur-md text-rose-200" :
                transcribing ? "border-amber-300/30 bg-amber-500/10 backdrop-blur-md text-amber-200" :
                  sending ? "border-cyan-300/30 bg-cyan-500/10 backdrop-blur-md text-cyan-200" :
                    fetchingCoach ? "border-violet-300/30 bg-violet-500/10 backdrop-blur-md text-violet-200" :
                      "border-white/10 bg-slate-950/50 backdrop-blur-md text-slate-500"
              }`}>
              {recording ? "🔴 Rec" : transcribing ? "⏳ Transcribing" : sending ? "💭 Thinking" : fetchingCoach ? "🧠 Coaching" : "● Ready"}
            </div>

            <Link href="/dashboard" className="hidden lg:flex items-center justify-center rounded-full border border-white/10 bg-slate-950/50 backdrop-blur-md px-4 py-2 text-xs font-semibold text-slate-300 shadow-lg hover:border-cyan-300/30 hover:bg-white/10 hover:text-white transition">
              Progress
            </Link>
          </div>
        </header>

        {/* ─── Credits info modal ─── */}
        {showCreditsInfo && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowCreditsInfo(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

            {/* Card */}
            <div
              className="relative z-10 w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: "slideUp 0.2s ease both" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">How Credits Work</p>
                </div>
                <button
                  onClick={() => setShowCreditsInfo(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white transition text-sm"
                  type="button"
                >✕</button>
              </div>

              {/* Rules */}
              <div className="space-y-4 mb-5">
                <div className="flex items-start gap-3 rounded-[1rem] border border-white/6 bg-white/4 px-4 py-3">
                  <span className="text-xl mt-0.5">💬</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Every 5 messages = 1 credit</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Send 5 messages → 1 credit is deducted automatically</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[1rem] border border-white/6 bg-white/4 px-4 py-3">
                  <span className="text-xl mt-0.5">🔥</span>
                  <div>
                    <p className="text-sm font-semibold text-white">20 credits per day</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">= up to 100 messages total per day</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[1rem] border border-white/6 bg-white/4 px-4 py-3">
                  <span className="text-xl mt-0.5">🌙</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Resets every midnight</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Fresh 20 credits every new day — automatically</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[1rem] border border-white/6 bg-white/4 px-4 py-3">
                  <span className="text-xl mt-0.5">🚫</span>
                  <div>
                    <p className="text-sm font-semibold text-white">0 credits = chat blocked</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Come back tomorrow — credits reset at midnight</p>
                  </div>
                </div>
              </div>

              {/* Live status footer */}
              <div className="rounded-[1rem] border border-cyan-300/20 bg-cyan-500/8 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-slate-400">Current balance</p>
                    <p className={`text-lg font-bold font-mono ${creditsRemaining === 0 ? "text-rose-300" : "text-cyan-300"}`}>
                      {creditsRemaining} <span className="text-sm font-normal text-slate-500">/ {creditsTotal}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">Next deduction in</p>
                    <p className="text-lg font-bold font-mono text-white">
                      {msgsUntilNext} <span className="text-sm font-normal text-slate-500">msg{msgsUntilNext === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${creditsRemaining === 0 ? "bg-rose-400" : "bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]"}`}
                    style={{ width: `${(creditsRemaining / creditsTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Overlay close for mode panel ─── */}
        {(showModePanel || showVoicePanel) && (
          <div className="fixed inset-0 z-10" onClick={() => { setShowModePanel(false); setShowVoicePanel(false); }} />
        )}

        {/* ─── Messages Area ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
          <div className="mx-auto max-w-2xl space-y-5">

            {!token && (
              <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                Please <Link className="underline" href="/login">log in</Link> to continue.
              </div>
            )}

            {loading && (
              <div className="space-y-5 animate-pulse">
                {[false, true, false].map((right, i) => (
                  <div key={i} className={`flex items-end gap-3 ${right ? "flex-row-reverse" : ""}`}>
                    {!right && <div className="h-8 w-8 flex-shrink-0 rounded-full bg-white/10" />}
                    <div className={`h-20 rounded-[1.6rem] bg-white/5 border border-white/8 ${right ? "w-[55%]" : "w-[65%]"}`} />
                  </div>
                ))}
                <p className="text-center text-xs text-slate-600 animate-pulse">Loading conversation…</p>
              </div>
            )}

            {/* Empty state */}
            {!loading && conversation?.messages.length === 0 && (
              <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/3 px-6 py-10 text-center"
                style={{ animation: "slideUp 0.4s ease both" }}>
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${currentMode.avatarGrad} text-2xl shadow-xl mb-4`}>
                  {currentMode.icon}
                </div>
                <p className="text-sm font-semibold text-white">
                  {coachMode === "strict" ? "Ready to challenge you." : coachMode === "casual" ? "Hey, let's chat!" : "Hi! I'm your AI coach."}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {coachMode === "strict" ? "Show me what you've got. Don't hold back." : coachMode === "casual" ? "Just talk, no pressure 😊" : "After each message I'll give you live feedback to help you improve."}
                </p>
              </div>
            )}

            {/* Messages */}
            {conversation?.messages.map((entry) => {
              const isUser = entry.sender_role === "user";
              const isSpeaking = speakingMessageId === entry.id;
              const hasReaction = reactions[entry.id];
              return (
                <div
                  key={entry.id}
                  className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  style={{ animation: "slideUp 0.3s ease both" }}
                  onMouseLeave={() => setShowReactionFor(null)}
                >
                  {/* Avatar */}
                  {!isUser && (
                    <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-lg transition ${isSpeaking ? "scale-110" : ""
                      } ${currentMode.avatarGrad} text-slate-950`}>
                      {currentMode.icon}
                    </div>
                  )}

                  <div className="group flex flex-col gap-1.5 max-w-[90%] sm:max-w-[85%] md:max-w-[80%]">
                    <p className={`text-[10px] uppercase tracking-[0.2em] text-slate-600 ${isUser ? "text-right" : ""}`}>
                      {isUser ? "You" : currentMode.label} · {formatTimestamp(entry.created_at)}
                    </p>

                    <div className={`relative rounded-[1.6rem] px-5 py-4 text-sm leading-7 shadow-lg ${isUser
                        ? "rounded-br-sm bg-[linear-gradient(135deg,rgba(105,226,255,0.92),rgba(167,243,208,0.75))] text-slate-950"
                        : "rounded-bl-sm border border-white/10 bg-[rgba(7,16,29,0.88)] text-slate-100"
                      }`}>
                      <p className="whitespace-pre-wrap">{entry.content}</p>
                      {hasReaction && (
                        <span className="absolute -bottom-2 -right-1 text-base">{hasReaction}</span>
                      )}
                    </div>

                    <div className={`flex items-center gap-2 mt-0.5 ${isUser ? "flex-row-reverse" : ""}`}>
                      {!isUser && (
                        <button
                          className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${isSpeaking ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400 hover:border-cyan-300/25 hover:text-white"
                            }`}
                          onClick={() => void playAiReply(entry)}
                          type="button"
                        >
                          {isSpeaking ? "🔊 Playing" : "🔊 Listen"}
                        </button>
                      )}

                      {/* Reaction picker */}
                      <div className="relative">
                        <button
                          className="rounded-full border border-white/8 bg-white/4 px-2 py-1 text-[11px] text-slate-500 opacity-100 md:opacity-0 group-hover:opacity-100 hover:text-white transition"
                          onClick={() => setShowReactionFor(showReactionFor === entry.id ? null : entry.id)}
                          type="button"
                        >
                          {hasReaction || "＋"}
                        </button>
                        {showReactionFor === entry.id && (
                          <div className={`absolute bottom-8 ${isUser ? "right-0" : "left-0"} z-10 flex gap-1.5 rounded-[1.2rem] border border-white/10 bg-slate-900 p-2 shadow-xl`}>
                            {REACTIONS.map((r) => (
                              <button key={r} className="rounded-lg p-1.5 text-lg hover:bg-white/10 transition"
                                onClick={() => { setReactions((p) => ({ ...p, [entry.id]: r })); setShowReactionFor(null); }}
                                type="button">{r}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {sending && <TypingIndicator mode={coachMode} />}

            {/* Coach analyzing indicator */}
            {fetchingCoach && !coachFeedback && (
              <div className="flex items-center gap-2.5 px-2"
                style={{ animation: "slideUp 0.3s ease both" }}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${currentMode.avatarGrad} text-xs`}>{currentMode.icon}</span>
                <span className="text-xs text-slate-500 animate-pulse">Analyzing your response…</span>
              </div>
            )}

            {/* ─── Live Coach Feedback Card ─── */}
            {coachFeedback && (
              <CoachFeedbackCard
                feedback={coachFeedback}
                mode={coachMode}
                onDismiss={() => setCoachFeedback(null)}
                onApplyBetter={(text) => {
                  setMessage(text);
                  setCoachFeedback(null);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              />
            )}

            <div ref={messagesEndRef} />

            {creditsRemaining === 0 && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-md px-6"
                style={{ animation: "slideUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
                <div className="w-full max-w-sm rounded-[2rem] border border-rose-300/20 bg-slate-950 p-8 text-center shadow-2xl">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-rose-300/20 bg-rose-500/10 text-3xl">
                    🌙
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Today&apos;s limit reached</h2>
                  <p className="text-sm text-slate-400 leading-6 mb-1">
                    You&apos;ve used all <span className="text-white font-semibold">20 credits</span> for today.
                  </p>
                  <p className="text-sm text-slate-400 leading-6 mb-6">
                    Your credits reset every day at midnight.<br />
                    Come back tomorrow to continue! 🚀
                  </p>
                  <div className="rounded-[1.3rem] border border-white/8 bg-white/4 px-4 py-3 mb-5">
                    <p className="text-[11px] text-slate-500 mb-1">Resets in</p>
                    <p className="text-lg font-bold text-cyan-300">
                      {(() => {
                        const now = new Date();
                        const midnight = new Date();
                        midnight.setDate(midnight.getDate() + 1);
                        midnight.setHours(0, 0, 0, 0);
                        const diff = midnight.getTime() - now.getTime();
                        const h = Math.floor(diff / 3600000);
                        const m = Math.floor((diff % 3600000) / 60000);
                        return `${h}h ${m}m`;
                      })()}
                    </p>
                  </div>
                  <Link href="/portal" className="block w-full rounded-[1.3rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 hover:opacity-90 transition">
                    Go to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Error Bar ─── */}
        {error && (
          <div className="border-t border-rose-400/10 bg-rose-500/8 px-4 py-3 text-sm text-rose-200 flex items-center gap-2">
            <span>❌ {error}</span>
            <button className="ml-auto text-xs text-slate-400 hover:text-white" onClick={() => setError("")} type="button">Dismiss</button>
          </div>
        )}

        {/* ─── Rubric Panel ─── */}
        {rubric && (
          <div className="border-t border-white/8 bg-slate-950/50 px-4 py-4 md:px-6 backdrop-blur-sm">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-medium">📊 Answer quality</p>
                <button className="text-xs text-slate-500 hover:text-white transition" onClick={() => setRubric(null)} type="button">Close</button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl font-bold text-white">{rubric.overall_score.toFixed(0)}</span>
                <div>
                  <p className="text-sm text-slate-300">Overall score</p>
                  <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]" style={{ width: `${Math.min(rubric.overall_score, 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 mb-3">
                {Object.entries(rubric.scores).map(([key, val]) => (
                  <div key={key} className="rounded-[1.1rem] border border-white/8 bg-white/4 px-4 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-300">{key.replaceAll("_", " ")}</span>
                      <span className="font-semibold text-white">{val.toFixed(0)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]" style={{ width: `${Math.max(4, Math.min(val, 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {rubric.action_items.length > 0 && (
                <div className="rounded-[1.25rem] border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Try this next</p>
                  {rubric.action_items.map((item) => (
                    <p key={item} className="text-xs text-slate-300 mb-1">• {item}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Input Area ─── */}
        <div className="border-t border-white/8 bg-slate-950/30 px-4 py-3 md:px-6 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl space-y-3">

            {/* Improve / quality buttons (shown only when text is typed) */}
            {message.trim() && canAct && (
              <div className="flex flex-wrap gap-2 items-center">
                {[
                  { mode: "make natural", label: "Improve" },
                  { mode: "make professional", label: "Professional" },
                  { mode: "make shorter", label: "Shorten" },
                  { mode: "make interview-ready", label: "Interview ready" },
                ].map(({ mode, label }) => (
                  <button
                    key={mode}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/25 hover:text-white transition disabled:opacity-40"
                    onClick={() => void rewriteDraft(mode)}
                    disabled={!!rewritingMode || sending}
                    type="button"
                  >
                    {rewritingMode === mode ? "…" : label}
                  </button>
                ))}
                <span className="w-px h-5 self-center bg-white/10" />
                <button
                  className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition disabled:opacity-40"
                  onClick={() => void scoreDraft()}
                  disabled={scoring || sending || !canAct}
                  type="button"
                >
                  {scoring ? "Scoring…" : "📊 Score"}
                </button>
              </div>
            )}

            {/* Message form */}
            <form className="flex items-center gap-2" onSubmit={handleSubmit}>
              <button
                className={`flex-shrink-0 flex items-center gap-2 rounded-[1.2rem] border px-3 py-3 text-sm font-medium transition ${recording ? "border-rose-300/40 bg-rose-500/20 text-rose-100" : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:text-white"
                  }`}
                onClick={recording ? stopRecording : () => void startRecording()}
                type="button"
              >
                {recording ? <Waveform active /> : transcribing ? <span className="animate-pulse text-xs">⏳</span> : "🎙️"}
              </button>

              <input
                ref={inputRef}
                className="flex-1 min-w-0 rounded-[1.2rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                onChange={(e) => setMessage(e.target.value)}
                placeholder={creditsRemaining === 0 ? "No credits left — resets tomorrow…" : coachMode === "strict" ? "Respond clearly and concisely…" : coachMode === "casual" ? "Just say what you think…" : "Type your response…"}
                value={message}
                disabled={creditsRemaining === 0}
              />

              <button
                className="flex-shrink-0 rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.03] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={sending || transcribing || !message.trim() || !canAct || creditsRemaining === 0}
                type="submit"
              >
                {sending ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-slate-950" /> : "Send"}
              </button>
            </form>

            {/* Coach mode hint / credit hint */}
            {creditsRemaining > 0 ? (
              <p className="text-center text-[10px] text-slate-600">
                {coachEnabled ? `${currentMode.icon} ${currentMode.label} mode · ` : ""}
                🔥 {creditsRemaining}/{creditsTotal} credits · next deduction in {msgsUntilNext} msg{msgsUntilNext === 1 ? "" : "s"} · resets daily
              </p>
            ) : (
              <p className="text-center text-[10px] text-rose-500">
                No credits left today — resets at midnight 🌙
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
