"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";

/* ─── Types ─── */
type AssessmentQuestion = {
  key: string;
  order: number;
  category: string;
  title: string;
  prompt: string;
  placeholder: string;
  answer_type: string;
  min_length: number;
};

type AssessmentOverview = {
  status: string;
  current_level: string | null;
  questions: AssessmentQuestion[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ─── MCQ bank (static, grammar + meaning) ─── */
type MCQ = { id: number; q: string; options: string[]; answer: number };
const MCQ_QUESTIONS: MCQ[] = [
  {
    id: 1,
    q: "Which sentence is grammatically correct?",
    options: [
      "She don't know the answer.",
      "She doesn't know the answer.",
      "She not know the answer.",
      "She didn't knew the answer.",
    ],
    answer: 1,
  },
  {
    id: 2,
    q: "What does 'eloquent' mean?",
    options: [
      "Very loud and aggressive",
      "Fluent and persuasive in speaking",
      "Shy and reserved",
      "Confused and uncertain",
    ],
    answer: 1,
  },
  {
    id: 3,
    q: "Choose the correct past tense: 'I __ to the store yesterday.'",
    options: ["go", "gone", "went", "have gone"],
    answer: 2,
  },
  {
    id: 4,
    q: "Which word is a synonym for 'concise'?",
    options: ["Lengthy", "Brief", "Detailed", "Repetitive"],
    answer: 1,
  },
  {
    id: 5,
    q: "Which sentence uses the correct article?",
    options: [
      "She is an honest person.",
      "She is a honest person.",
      "She is honest the person.",
      "She is one honest person.",
    ],
    answer: 0,
  },
];

/* ─── Listening prompts (static audio-transcript pairs) ─── */
type ListeningItem = { text: string; question: string; options: string[]; answer: number };
const LISTENING_ITEMS: ListeningItem[] = [
  {
    text: "Hi, I'm calling to schedule a meeting for next Tuesday at 3pm. Please let me know if that works for you.",
    question: "What is the caller trying to do?",
    options: [
      "Cancel an existing meeting",
      "Schedule a new meeting",
      "Ask for more information",
      "Complain about a schedule",
    ],
    answer: 1,
  },
  {
    text: "The train to London will depart from platform 4 at 8:45. Passengers should have their tickets ready for inspection.",
    question: "What should passengers do before boarding?",
    options: [
      "Buy a ticket at the platform",
      "Wait for the conductor",
      "Have their tickets ready",
      "Go to platform 3",
    ],
    answer: 2,
  },
];

/* ─── Mini conversation AI questions ─── */
const MINI_CONV_QUESTIONS = [
  "Tell me about yourself and your English learning goals.",
  "Describe a challenge you faced recently and how you handled it.",
];

/* ─── Assessment stages ─── */
type Stage =
  | "intro"
  | "speaking"
  | "listening"
  | "mcq"
  | "mini_conv"
  | "written"
  | "submitting"
  | "done";

/* ─── Waveform for voice ─── */
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-6 justify-center">
      {[3, 6, 9, 6, 10, 5, 8, 4, 7, 3].map((h, i) => (
        <span
          key={i}
          className="w-[4px] rounded-full bg-rose-400"
          style={{
            height: `${h * 2.5}px`,
            animation: active
              ? `waveBar 0.6s ease-in-out ${i * 0.07}s infinite alternate`
              : "none",
            opacity: active ? 1 : 0.2,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Score helpers ─── */
function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

function computeScores(answers: Record<string, string>) {
  const combined = Object.values(answers).join(" ");
  const words = combined.match(/[a-zA-Z']+/g) ?? [];
  const sentences = combined.match(/[.!?]+/g) ?? [];
  const wc = words.length;
  const unique = new Set(words.map((w) => w.toLowerCase())).size;
  const sc = Math.max(sentences.length, 1);
  const awps = wc / sc;
  const fillers = [" um ", " uh ", " maybe ", " i think "].reduce(
    (n, f) => n + (combined.toLowerCase().includes(f) ? 1 : 0), 0
  );
  const complex = ["because","although","however","while","therefore","which","since"].filter(
    (w) => combined.toLowerCase().includes(w)
  ).length;

  return {
    grammar_accuracy: clamp(78 + sc * 3 - fillers * 5 - Math.max(0, 12 - awps) * 1.4),
    fluency: clamp(awps * 7 + (wc > 120 ? 10 : 0) - fillers * 6),
    vocabulary_diversity: clamp((unique / Math.max(wc, 1)) * 120 + (wc > 80 ? 10 : 0)),
    confidence: clamp(70 + (wc > 90 ? 12 : 0) - fillers * 10),
    sentence_complexity: clamp(awps * 6 + complex * 6),
    answer_completeness: clamp((wc / Math.max(Object.keys(answers).length, 1)) * 6),
  };
}

export default function AssessmentPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Stage state */
  const [stage, setStage] = useState<Stage>("intro");
  const [stageStep, setStageStep] = useState(0); // sub-index within a stage

  /* Speaking */
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingTranscripts, setSpeakingTranscripts] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /* Listening */
  const [listeningIdx, setListeningIdx] = useState(0);
  const [listeningRevealed, setListeningRevealed] = useState(false);
  const [listeningAnswer, setListeningAnswer] = useState<number | null>(null);
  const [listeningScore, setListeningScore] = useState(0);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  /* MCQ */
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const mcqScore = MCQ_QUESTIONS.filter((q) => mcqAnswers[q.id] === q.answer).length;

  /* Mini conversation */
  const [miniAnswers, setMiniAnswers] = useState<string[]>(["", ""]);
  const [miniIdx, setMiniIdx] = useState(0);

  /* Written (from backend questions) */
  const [writtenIdx, setWrittenIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  /* ─── Load token + questions ─── */
  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/assessment/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<AssessmentOverview>(res);
        if (data.status === "completed") { router.replace("/assessment/result"); return; }
        setQuestions(data.questions);
        setAnswers(Object.fromEntries(data.questions.map((q) => [q.key, ""])));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load assessment.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router, token]);

  /* ─── Speaking: record ─── */
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) { setError("Microphone not available."); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); });
      recorder.addEventListener("stop", () => void transcribeVoice());
      recorder.start();
      setIsRecording(true);
    } catch { setError("Could not access microphone."); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setIsRecording(false);
  }

  async function transcribeVoice() {
    if (audioChunksRef.current.length === 0) return;
    setIsTranscribing(true);
    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("language", "en");
      form.append("prompt", "English self-introduction");
      const res = await fetch(`${API_BASE_URL}/speech/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await readApiData<{ text: string }>(res);
      setSpeakingTranscripts((prev) => {
        const next = [...prev];
        next[stageStep] = data.text;
        return next;
      });
    } catch { setError("Transcription failed. You can type instead."); }
    finally { audioChunksRef.current = []; setIsTranscribing(false); }
  }

  /* ─── Listening: text-to-speech ─── */
  function playListeningText(text: string) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    synthRef.current = utter;
    setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  /* ─── Progress tracking ─── */
  const STAGES: Stage[] = ["speaking", "listening", "mcq", "mini_conv", "written"];
  const stageIdx = STAGES.indexOf(stage);
  const totalStages = STAGES.length;
  const progressPct = stage === "intro" ? 0 : stage === "done" || stage === "submitting" ? 100 : Math.round(((stageIdx + 0.5) / totalStages) * 100);

  /* ─── Submit ─── */
  async function handleSubmit() {
    setSubmitting(true);
    setStage("submitting");
    setError("");

    // Merge speaking transcripts into answers
    const speakingPrompts = questions.filter((q) => q.category === "self_introduction" || q.order <= 2);
    const finalAnswers = { ...answers };
    speakingTranscripts.forEach((t, i) => {
      const key = speakingPrompts[i]?.key;
      if (key && t) finalAnswers[key] = t;
    });
    // Merge mini-conv answers
    miniAnswers.forEach((a, i) => {
      const q = questions.find((q) => q.category === "follow_up" && q.order === i + 3);
      if (q && a) finalAnswers[q.key] = a;
    });

    try {
      const res = await fetch(`${API_BASE_URL}/assessment/onboarding/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          answers: questions.map((q) => ({
            question_key: q.key,
            answer_text: finalAnswers[q.key] ?? "",
            answer_type: "text",
          })),
        }),
      });
      await readApiData(res);
      router.push("/assessment/result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Try again.");
      setStage("written");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    try {
      const res = await fetch(`${API_BASE_URL}/assessment/onboarding/skip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await readApiData(res);
      router.push("/portal");
    } catch { setError("Could not skip. Try again."); }
  }

  /* ─── Current written question ─── */
  const writtenQuestion = questions[writtenIdx] ?? null;
  const writtenAnswer = writtenQuestion ? (answers[writtenQuestion.key] ?? "") : "";
  const writtenReady = writtenAnswer.trim().length >= (writtenQuestion?.min_length ?? 40);
  const allWrittenDone = questions.every((q) => (answers[q.key]?.trim().length ?? 0) >= q.min_length);

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <main className="app-shell grid-overlay min-h-screen flex items-center justify-center px-4 text-slate-100">
        <div className="text-center animate-pulse space-y-4">
          <div className="text-5xl">🧠</div>
          <p className="text-slate-400 text-sm">Preparing your assessment…</p>
          <div className="h-2 w-48 mx-auto rounded-full bg-white/10" />
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @keyframes waveBar { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-6 md:py-8">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">

          {/* ─── Header bar ─── */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Smart Assessment 2.0</p>
              <p className="text-sm font-semibold text-white">English Level Check</p>
            </div>
            <button
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
              onClick={() => void handleSkip()}
              type="button"
            >
              Skip for now
            </button>
          </div>

          {/* ─── Progress bar ─── */}
          {stage !== "intro" && (
            <div>
              <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                <span>{["Speaking", "Listening", "Grammar", "Conversation", "Writing"][Math.max(stageIdx, 0)] ?? "Wrap up"}</span>
                <span>{progressPct}% complete</span>
              </div>
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)] transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Stage dots */}
              <div className="mt-3 flex justify-between px-1">
                {["🎙️", "🎧", "✏️", "💬", "📝"].map((icon, i) => (
                  <div key={i} className={`flex flex-col items-center gap-1 text-sm ${i <= stageIdx ? "opacity-100" : "opacity-25"}`}>
                    <span>{icon}</span>
                    <span className="text-[9px] text-slate-500">{["Speak", "Listen", "MCQ", "Chat", "Write"][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: INTRO
          ══════════════════════════ */}
          {stage === "intro" && (
            <div className="fade-up glass-panel rounded-[2rem] p-6 md:p-8">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(ellipse_at_top_left,rgba(105,226,255,0.12),transparent_50%)]" />
              <div className="relative">
                <p className="text-4xl mb-4">🧠</p>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-medium">English Level Check</p>
                <h1 className="mt-3 text-3xl font-bold text-white leading-tight">
                  Find your real level in 5 minutes
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  This assessment tests your speaking, listening, grammar, and writing — just like a real English test, but faster. No pressure. Just talk naturally.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { icon: "🎙️", label: "Speaking", desc: "30 sec intro" },
                    { icon: "🎧", label: "Listening", desc: "Short audio" },
                    { icon: "✏️", label: "Grammar", desc: "5 questions" },
                    { icon: "📝", label: "Writing", desc: "Short answers" },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/4 p-4 text-center">
                      <span className="text-2xl">{icon}</span>
                      <p className="mt-2 text-xs font-semibold text-white">{label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-cyan-300/15 bg-cyan-500/8 px-5 py-4">
                  <p className="text-sm text-slate-300">
                    <span className="text-cyan-300 font-medium">Output: </span>
                    Your CEFR level (A1–C2) · Strengths & weaknesses · Personalized scenarios to practice
                  </p>
                </div>

                <button
                  className="mt-6 w-full rounded-[1.5rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-6 py-4 text-base font-bold text-slate-950 transition hover:scale-[1.01]"
                  onClick={() => setStage("speaking")}
                  type="button"
                >
                  Start Assessment →
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: SPEAKING TEST
          ══════════════════════════ */}
          {stage === "speaking" && (
            <div className="fade-up space-y-4">
              <div className="glass-panel rounded-[2rem] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-xl border border-rose-300/20">🎙️</span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-rose-300">Speaking Test</p>
                    <p className="text-sm font-semibold text-white">Part {stageStep + 1} of 2</p>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white">
                  {stageStep === 0
                    ? "Introduce yourself (30 seconds)"
                    : "Describe your English learning goal"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {stageStep === 0
                    ? "Say your name, where you're from, and what you do."
                    : "Why do you want to improve your English? What's your goal?"}
                </p>

                {/* Waveform + control */}
                <div className="mt-6 flex flex-col items-center gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/50 py-8 px-4">
                  <Waveform active={isRecording} />

                  {isTranscribing ? (
                    <p className="text-sm text-amber-300 animate-pulse">Analyzing your speech…</p>
                  ) : speakingTranscripts[stageStep] ? (
                    <div className="w-full rounded-[1.3rem] border border-emerald-300/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Transcript</p>
                      <p>{speakingTranscripts[stageStep]}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Press record and speak clearly</p>
                  )}

                  <button
                    className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition ${
                      isRecording
                        ? "bg-rose-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.4)] animate-pulse"
                        : "bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] text-slate-950 shadow-[0_0_14px_rgba(105,226,255,0.35)] hover:scale-[1.02]"
                    }`}
                    onClick={isRecording ? stopRecording : () => void startRecording()}
                    type="button"
                  >
                    {isRecording ? "⏹ Stop recording" : "🎙️ Start recording"}
                  </button>
                </div>

                {/* Optional type-in fallback */}
                <div className="mt-4">
                  <p className="text-[11px] text-slate-500 mb-1.5">Or type your answer:</p>
                  <textarea
                    className="w-full rounded-[1.2rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/25 resize-none transition"
                    rows={3}
                    placeholder="Type if recording isn't available…"
                    value={speakingTranscripts[stageStep] ?? ""}
                    onChange={(e) =>
                      setSpeakingTranscripts((prev) => {
                        const next = [...prev];
                        next[stageStep] = e.target.value;
                        return next;
                      })
                    }
                  />
                </div>

                {error && <p className="mt-3 text-xs text-rose-300">⚠️ {error}</p>}

                <div className="mt-5 flex gap-3">
                  {stageStep > 0 && (
                    <button
                      className="flex-1 rounded-[1.2rem] border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                      onClick={() => setStageStep((p) => p - 1)}
                      type="button"
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    className="flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50 transition hover:scale-[1.01]"
                    disabled={!speakingTranscripts[stageStep]?.trim()}
                    onClick={() => {
                      if (stageStep === 0) { setStageStep(1); }
                      else { setStage("listening"); setListeningIdx(0); }
                    }}
                    type="button"
                  >
                    {stageStep === 0 ? "Next →" : "Continue →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: LISTENING TEST
          ══════════════════════════ */}
          {stage === "listening" && (
            <div className="fade-up space-y-4">
              <div className="glass-panel rounded-[2rem] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-xl border border-cyan-300/20">🎧</span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Listening Test</p>
                    <p className="text-sm font-semibold text-white">Question {listeningIdx + 1} of {LISTENING_ITEMS.length}</p>
                  </div>
                </div>

                {(() => {
                  const item = LISTENING_ITEMS[listeningIdx];
                  if (!item) return null;
                  return (
                    <>
                      <h2 className="text-xl font-bold text-white">Listen and answer</h2>
                      <p className="mt-1 text-sm text-slate-400">Press play, listen carefully, then choose the correct answer.</p>

                      {/* Audio player (TTS) */}
                      <div className="mt-5 flex flex-col items-center gap-3 rounded-[1.75rem] border border-white/10 bg-slate-950/50 py-6">
                        {listeningRevealed ? (
                          <div className="px-4 rounded-[1.2rem] border border-cyan-300/15 bg-cyan-500/8 py-3 w-full">
                            <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">Audio content</p>
                            <p className="text-sm text-slate-200">{item.text}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex items-end gap-[3px] h-6">
                              {[3, 7, 5, 9, 4, 8, 5].map((h, i) => (
                                <span
                                  key={i}
                                  className="w-[4px] rounded-full bg-cyan-400"
                                  style={{
                                    height: `${h * 2.5}px`,
                                    animation: isSpeaking ? `waveBar 0.6s ease-in-out ${i * 0.07}s infinite alternate` : "none",
                                    opacity: isSpeaking ? 1 : 0.25,
                                  }}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-slate-500">{isSpeaking ? "Playing…" : "Press play to hear the audio"}</p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            className="flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_14px_rgba(105,226,255,0.3)] hover:scale-[1.02] transition"
                            onClick={() => playListeningText(item.text)}
                            type="button"
                          >
                            {isSpeaking ? "🔊 Playing…" : "▶ Play audio"}
                          </button>
                          <button
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-400 hover:text-white transition"
                            onClick={() => setListeningRevealed(true)}
                            type="button"
                          >
                            Read text
                          </button>
                        </div>
                      </div>

                      {/* Question */}
                      <div className="mt-5">
                        <p className="text-base font-semibold text-white mb-3">{item.question}</p>
                        <div className="space-y-2">
                          {item.options.map((opt, i) => (
                            <button
                              key={i}
                              className={`w-full rounded-[1.2rem] border px-4 py-3 text-left text-sm transition ${
                                listeningAnswer === null
                                  ? "border-white/10 bg-white/4 text-slate-200 hover:border-cyan-300/25"
                                  : listeningAnswer === i && i === item.answer
                                    ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100"
                                    : listeningAnswer === i
                                      ? "border-rose-300/30 bg-rose-500/10 text-rose-200"
                                      : i === item.answer
                                        ? "border-emerald-300/20 bg-emerald-500/8 text-emerald-200"
                                        : "border-white/5 bg-white/2 text-slate-500"
                              }`}
                              onClick={() => {
                                if (listeningAnswer !== null) return;
                                setListeningAnswer(i);
                                if (i === item.answer) setListeningScore((s) => s + 1);
                              }}
                              type="button"
                            >
                              <span className="mr-3 text-slate-500">{String.fromCharCode(65 + i)}.</span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {listeningAnswer !== null && (
                        <div className={`mt-3 rounded-[1.2rem] border px-4 py-3 text-sm ${
                          listeningAnswer === item.answer
                            ? "border-emerald-300/20 bg-emerald-500/8 text-emerald-200"
                            : "border-rose-300/20 bg-rose-500/8 text-rose-200"
                        }`}>
                          {listeningAnswer === item.answer ? "✅ Correct!" : `❌ The correct answer was: ${item.options[item.answer]}`}
                        </div>
                      )}

                      <button
                        className="mt-5 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50 transition hover:scale-[1.01]"
                        disabled={listeningAnswer === null}
                        onClick={() => {
                          setListeningAnswer(null);
                          setListeningRevealed(false);
                          window.speechSynthesis.cancel();
                          setIsSpeaking(false);
                          if (listeningIdx + 1 < LISTENING_ITEMS.length) {
                            setListeningIdx((i) => i + 1);
                          } else {
                            setStage("mcq");
                          }
                        }}
                        type="button"
                      >
                        {listeningIdx + 1 < LISTENING_ITEMS.length ? "Next question →" : "Continue →"}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: MCQ Grammar
          ══════════════════════════ */}
          {stage === "mcq" && (
            <div className="fade-up space-y-4">
              <div className="glass-panel rounded-[2rem] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-xl border border-violet-300/20">✏️</span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-violet-300">Grammar & Meaning</p>
                    <p className="text-sm font-semibold text-white">{mcqSubmitted ? `Score: ${mcqScore}/${MCQ_QUESTIONS.length}` : `${Object.keys(mcqAnswers).length}/${MCQ_QUESTIONS.length} answered`}</p>
                  </div>
                </div>

                {!mcqSubmitted ? (
                  <>
                    <h2 className="text-xl font-bold text-white mb-4">Quick grammar check</h2>
                    <div className="space-y-5">
                      {MCQ_QUESTIONS.map((q) => (
                        <div key={q.id} className="rounded-[1.6rem] border border-white/8 bg-slate-950/50 p-5">
                          <p className="text-sm font-semibold text-white mb-3">{q.q}</p>
                          <div className="grid gap-2">
                            {q.options.map((opt, i) => (
                              <button
                                key={i}
                                className={`rounded-[1rem] border px-4 py-2.5 text-left text-xs transition ${
                                  mcqAnswers[q.id] === i
                                    ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100"
                                    : "border-white/8 bg-white/3 text-slate-300 hover:border-white/20"
                                }`}
                                onClick={() => setMcqAnswers((p) => ({ ...p, [q.id]: i }))}
                                type="button"
                              >
                                <span className="mr-2 text-slate-500">{String.fromCharCode(65 + i)}.</span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      className="mt-5 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50 transition hover:scale-[1.01]"
                      disabled={Object.keys(mcqAnswers).length < MCQ_QUESTIONS.length}
                      onClick={() => setMcqSubmitted(true)}
                      type="button"
                    >
                      Submit answers →
                    </button>
                  </>
                ) : (
                  <>
                    {/* Results */}
                    <div className={`rounded-[1.5rem] border p-5 text-center mb-5 ${
                      mcqScore >= 4 ? "border-emerald-300/25 bg-emerald-500/10" : mcqScore >= 2 ? "border-amber-300/25 bg-amber-500/10" : "border-rose-300/25 bg-rose-500/10"
                    }`}>
                      <p className="text-4xl font-bold text-white">{mcqScore}/{MCQ_QUESTIONS.length}</p>
                      <p className={`mt-1 text-sm font-medium ${mcqScore >= 4 ? "text-emerald-300" : mcqScore >= 2 ? "text-amber-300" : "text-rose-300"}`}>
                        {mcqScore >= 4 ? "Excellent!" : mcqScore >= 2 ? "Good effort" : "Keep practicing!"}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {MCQ_QUESTIONS.map((q) => {
                        const selected = mcqAnswers[q.id];
                        const correct = selected === q.answer;
                        return (
                          <div key={q.id} className={`rounded-[1.2rem] border px-4 py-3 text-sm ${correct ? "border-emerald-300/20 bg-emerald-500/8" : "border-rose-300/20 bg-rose-500/8"}`}>
                            <p className={`text-xs font-medium mb-1 ${correct ? "text-emerald-400" : "text-rose-400"}`}>{correct ? "✅ Correct" : "❌ Incorrect"}</p>
                            <p className="text-slate-300">{q.q}</p>
                            {!correct && <p className="text-slate-400 text-xs mt-1">Answer: {q.options[q.answer]}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="mt-5 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.01]"
                      onClick={() => { setStage("mini_conv"); setMiniIdx(0); }}
                      type="button"
                    >
                      Continue →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: MINI CONVERSATION
          ══════════════════════════ */}
          {stage === "mini_conv" && (
            <div className="fade-up space-y-4">
              <div className="glass-panel rounded-[2rem] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] text-slate-950 text-sm font-bold">AI</div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Live Mini Conversation</p>
                    <p className="text-sm font-semibold text-white">Question {miniIdx + 1} of {MINI_CONV_QUESTIONS.length}</p>
                  </div>
                </div>

                {/* AI "message" bubble */}
                <div className="rounded-[1.6rem] rounded-tl-sm border border-white/10 bg-[rgba(7,16,29,0.88)] px-5 py-4 mb-5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">AI Coach</p>
                  <p className="text-base text-slate-100 leading-7">{MINI_CONV_QUESTIONS[miniIdx]}</p>
                </div>

                {/* User answer */}
                <div>
                  <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-2">Your answer</p>
                  <textarea
                    className="w-full rounded-[1.6rem] rounded-tr-sm border border-cyan-300/15 bg-[rgba(105,226,255,0.05)] px-5 py-4 text-sm text-white outline-none focus:border-cyan-300/30 resize-none transition"
                    rows={5}
                    placeholder="Write your answer naturally…"
                    value={miniAnswers[miniIdx] ?? ""}
                    onChange={(e) =>
                      setMiniAnswers((prev) => {
                        const next = [...prev];
                        next[miniIdx] = e.target.value;
                        return next;
                      })
                    }
                  />
                  <p className="text-right text-[10px] text-slate-600 mt-1">
                    {miniAnswers[miniIdx]?.trim().split(/\s+/).filter(Boolean).length ?? 0} words
                  </p>
                </div>

                <div className="mt-4 flex gap-3">
                  {miniIdx > 0 && (
                    <button
                      className="flex-1 rounded-[1.2rem] border border-white/10 bg-white/5 py-3 text-sm font-medium text-white"
                      onClick={() => setMiniIdx((p) => p - 1)}
                      type="button"
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    className="flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50 transition hover:scale-[1.01]"
                    disabled={(miniAnswers[miniIdx]?.trim().split(/\s+/).filter(Boolean).length ?? 0) < 5}
                    onClick={() => {
                      if (miniIdx + 1 < MINI_CONV_QUESTIONS.length) { setMiniIdx((i) => i + 1); }
                      else { setStage("written"); setWrittenIdx(0); }
                    }}
                    type="button"
                  >
                    {miniIdx + 1 < MINI_CONV_QUESTIONS.length ? "Next →" : "Continue →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: WRITTEN QUESTIONS
          ══════════════════════════ */}
          {stage === "written" && writtenQuestion && (
            <div className="fade-up space-y-4">
              <div className="glass-panel rounded-[2rem] p-6 md:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-xl border border-amber-300/20">📝</span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Written Response</p>
                    <p className="text-sm font-semibold text-white">{writtenIdx + 1} of {questions.length}</p>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white">{writtenQuestion.title}</h2>
                <p className="mt-2 text-sm text-slate-400 leading-6">{writtenQuestion.prompt}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wider">
                    {writtenQuestion.category.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full border border-cyan-300/15 bg-cyan-500/8 px-3 py-1 text-[10px] text-cyan-300 uppercase tracking-wider">
                    Min {writtenQuestion.min_length} characters
                  </span>
                </div>

                <textarea
                  className="mt-4 w-full rounded-[1.5rem] border border-white/10 bg-slate-950/70 px-5 py-4 text-sm text-white outline-none focus:border-cyan-300/25 resize-none transition"
                  rows={7}
                  placeholder={writtenQuestion.placeholder}
                  value={writtenAnswer}
                  onChange={(e) => setAnswers((p) => ({ ...p, [writtenQuestion.key]: e.target.value }))}
                />

                {/* Character progress */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                  <span>{writtenAnswer.trim().length} / {writtenQuestion.min_length} min chars</span>
                  {writtenReady && <span className="text-emerald-400">✓ Ready</span>}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${writtenReady ? "bg-emerald-400" : "bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]"}`}
                    style={{ width: `${Math.min((writtenAnswer.trim().length / writtenQuestion.min_length) * 100, 100)}%` }}
                  />
                </div>

                {error && <p className="mt-3 text-xs text-rose-300">⚠️ {error}</p>}

                <div className="mt-5 flex gap-3">
                  {writtenIdx > 0 && (
                    <button
                      className="flex-1 rounded-[1.2rem] border border-white/10 bg-white/5 py-3 text-sm font-medium text-white"
                      onClick={() => setWrittenIdx((p) => p - 1)}
                      type="button"
                    >
                      ← Back
                    </button>
                  )}
                  {writtenIdx < questions.length - 1 ? (
                    <button
                      className="flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50 transition hover:scale-[1.01]"
                      disabled={!writtenReady}
                      onClick={() => setWrittenIdx((p) => p + 1)}
                      type="button"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      className="flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50 transition hover:scale-[1.01]"
                      disabled={!allWrittenDone || submitting}
                      onClick={() => void handleSubmit()}
                      type="button"
                    >
                      {submitting ? "Analyzing…" : "Submit Assessment →"}
                    </button>
                  )}
                </div>

                {/* Side question nav */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {questions.map((q, i) => {
                    const done = (answers[q.key]?.trim().length ?? 0) >= q.min_length;
                    return (
                      <button
                        key={q.key}
                        className={`h-8 w-8 rounded-full text-xs font-bold transition ${
                          i === writtenIdx
                            ? "bg-cyan-400 text-slate-950"
                            : done
                              ? "bg-emerald-500/20 border border-emerald-300/25 text-emerald-300"
                              : "bg-white/8 border border-white/10 text-slate-500 hover:border-white/25"
                        }`}
                        onClick={() => setWrittenIdx(i)}
                        type="button"
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STAGE: SUBMITTING
          ══════════════════════════ */}
          {stage === "submitting" && (
            <div className="fade-up glass-panel rounded-[2rem] p-8 text-center space-y-4">
              <div className="text-5xl animate-bounce">🧠</div>
              <h2 className="text-xl font-bold text-white">Analyzing your answers…</h2>
              <p className="text-sm text-slate-400">Our AI is calculating your level, strengths, and weaknesses. This takes 10–20 seconds.</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                <div className="h-full w-full animate-pulse rounded-full bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]" />
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
