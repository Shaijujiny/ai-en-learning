"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";
import { BackButton } from "@/components/BackButton";

/* ─── Types ─── */
type WordScore = {
  word: string;
  start: number | null;
  end: number | null;
  probability: number | null;
  flag: "ok" | "filler" | "uncertain";
};

type SpeakingAnalysis = {
  analysis_id: number;
  transcript: string;
  word_scores?: WordScore[];
  pronunciation: {
    overall_score: number;
    clarity: { score: number };
    pace: { wpm: number | null; score: number };
    pauses: {
      pause_count: number;
      long_pause_count: number;
      silence_gap_count: number;
      avg_pause_sec: number;
      longest_pause_sec: number;
      score: number;
    };
    filler_words: { count: number; examples: string[]; score: number };
    stress_patterns: { score: number; targets: string[] };
  };
  intonation: { suggestions: string[]; rhythm_markup: string };
  confidence: {
    overall_score: number;
    hesitation: { long_pause_count: number; silence_gap_count: number };
    repetition: { repetition_score: number; repeated_words: string[] };
    short_answer: { word_count: number; is_short: boolean };
    completeness: { score: number };
  };
  meta: { duration_sec: number | null; word_count: number; has_timestamps: boolean };
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ─── Helpers ─── */
function scoreLabel(value: number) {
  if (value >= 85) return "Excellent";
  if (value >= 70) return "Strong";
  if (value >= 55) return "Developing";
  return "Needs focus";
}

function scoreRing(value: number) {
  if (value >= 85) return "text-emerald-300";
  if (value >= 70) return "text-cyan-300";
  if (value >= 55) return "text-amber-300";
  return "text-rose-300";
}

/* ─── Word highlight + browser TTS ─── */
function speakWord(word: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = "en-US";
  utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
}

function WordTranscript({ words }: { words: WordScore[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (!words.length) return null;

  const FLAG_STYLES: Record<WordScore["flag"], string> = {
    ok: "text-slate-100 hover:text-white",
    filler: "bg-rose-500/20 text-rose-300 rounded px-0.5 border border-rose-400/30",
    uncertain: "bg-amber-500/15 text-amber-200 rounded px-0.5 border border-amber-400/25",
  };

  const FLAG_TOOLTIP: Record<WordScore["flag"], string> = {
    ok: "",
    filler: "Filler word — try removing it",
    uncertain: "Low confidence — check pronunciation",
  };

  return (
    <div className="leading-9 text-sm">
      {words.map((w, i) => (
        <span key={i} className="inline-block relative group">
          <button
            type="button"
            title={FLAG_TOOLTIP[w.flag] || `Click to pronounce "${w.word}"`}
            className={`mr-1 cursor-pointer transition-all ${FLAG_STYLES[w.flag]} ${active === i ? "scale-110" : ""}`}
            onClick={() => {
              setActive(i);
              speakWord(w.word.replace(/[.,!?;:'"]/g, ""));
              setTimeout(() => setActive(null), 800);
            }}
          >
            {w.word}
            {w.flag !== "ok" && (
              <span className="ml-0.5 text-[9px] align-super opacity-70">
                {w.flag === "filler" ? "✗" : "?"}
              </span>
            )}
          </button>
          {/* Tooltip */}
          {FLAG_TOOLTIP[w.flag] && (
            <span className="pointer-events-none absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 shadow-xl">
              {FLAG_TOOLTIP[w.flag]}
            </span>
          )}
        </span>
      ))}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-white/8 pt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block h-3 w-3 rounded-sm border border-rose-400/30 bg-rose-500/20" />
          Filler word
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-400/25 bg-amber-500/15" />
          Uncertain pronunciation
        </div>
        <div className="text-[11px] text-slate-600">🔊 Click any word to hear it</div>
      </div>
    </div>
  );
}

/* ─── Score bar ─── */
function ScoreBar({ label, value, note }: { label: string; value: number; note?: string }) {
  const color =
    value >= 85 ? "bg-emerald-400" : value >= 70 ? "bg-cyan-400" : value >= 55 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-200">{label}</span>
        <span className={`font-semibold ${scoreRing(value)}`}>{value.toFixed(1)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

/* ─── Waveform animation ─── */
function Waveform({ active }: { active: boolean }) {
  return (
    <div className={`flex items-end gap-0.5 h-5 ${active ? "" : "opacity-30"}`}>
      {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-rose-400"
          style={{
            height: `${h * 3}px`,
            animation: active ? `wave 0.9s ease-in-out ${i * 0.12}s infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function SpeakingPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [analysis, setAnalysis] = useState<SpeakingAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<"words" | "breakdown" | "intonation">("words");

  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token") ?? "";
    if (!storedToken) { router.replace("/login"); return; }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    async function loadLatest() {
      setLoadingLatest(true);
      try {
        const response = await fetch(`${API_BASE_URL}/speaking/latest`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<SpeakingAnalysis>(response);
        setAnalysis(data);
      } catch { /* no previous analysis yet */ } finally {
        setLoadingLatest(false);
      }
    }
    void loadLatest();
  }, [token]);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone recording is not supported in this browser.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        audioChunksRef.current = [];
        setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      });
      recorder.start();
      setRecording(true);
    } catch { setError("Unable to access microphone."); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setRecording(false);
  }

  async function analyzeRecording() {
    if (!token) return;
    const blob = audioBlobRef.current;
    if (!blob) { setError("Record a short answer first."); return; }
    setAnalyzing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", blob, "speaking.webm");
      formData.append("language", "en");
      formData.append("prompt", "English speaking practice");
      const response = await fetch(`${API_BASE_URL}/speaking/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await readApiData<SpeakingAnalysis>(response);
      setAnalysis(data);
      setActiveTab("words");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speaking analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  const flagCounts = analysis?.word_scores
    ? {
        filler: analysis.word_scores.filter((w) => w.flag === "filler").length,
        uncertain: analysis.word_scores.filter((w) => w.flag === "uncertain").length,
        ok: analysis.word_scores.filter((w) => w.flag === "ok").length,
      }
    : null;

  return (
    <>
      <style>{`
        @keyframes wave { from{transform:scaleY(0.4)} to{transform:scaleY(1.2)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
        <section className="mx-auto flex max-w-5xl flex-col gap-5">

          {/* ─── Header ─── */}
          <header className="glass-panel rounded-[2rem] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">Speaking Excellence</p>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h1 className="display text-3xl font-semibold text-white md:text-5xl">
                  Pronunciation · Intonation · Confidence
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Record a short answer. Every word gets scored — filler words and uncertain pronunciations are highlighted. Click any word to hear it spoken correctly.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <BackButton fallbackHref="/portal" label="Back" />
                  <Link className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white" href="/dashboard">
                    Dashboard
                  </Link>
                </div>
              </div>

              {/* ─── Recorder panel ─── */}
              <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Session</p>
                  {recording && <Waveform active />}
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition ${
                      recording
                        ? "bg-rose-500/20 border border-rose-400/30 text-rose-200 hover:bg-rose-500/30"
                        : "bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] text-slate-950"
                    } disabled:opacity-70`}
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    disabled={analyzing}
                  >
                    {recording ? "⏹ Stop recording" : "🎙 Start recording"}
                  </button>
                  <button
                    className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 transition hover:border-cyan-300/20"
                    type="button"
                    onClick={analyzeRecording}
                    disabled={recording || analyzing || !audioBlobRef.current}
                  >
                    {analyzing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
                        Analyzing…
                      </span>
                    ) : "Analyze recording →"}
                  </button>
                </div>
                {audioUrl && (
                  <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 mb-2">Playback</p>
                    <audio className="w-full" controls src={audioUrl} />
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ─── Error ─── */}
          {error && (
            <div className="glass-panel rounded-[2rem] p-5">
              <p className="rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
            </div>
          )}

          {loadingLatest && !analysis && (
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-sm text-slate-400 animate-pulse">Loading latest analysis…</p>
            </div>
          )}

          {/* ─── Analysis results ─── */}
          {analysis && (
            <section className="space-y-5" style={{ animation: "fadeUp 0.4s ease both" }}>

              {/* Score header row */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Pronunciation", val: analysis.pronunciation.overall_score },
                  { label: "Confidence", val: analysis.confidence.overall_score },
                  { label: "Clarity", val: analysis.pronunciation.clarity.score },
                  { label: "Pace", val: analysis.pronunciation.pace.score },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
                    <p className={`mt-2 text-3xl font-black ${scoreRing(val)}`}>{val.toFixed(0)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{scoreLabel(val)}</p>
                  </div>
                ))}
              </div>

              {/* Word stats strip */}
              {flagCounts && (
                <div className="flex flex-wrap gap-3 px-1">
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                    ✓ {flagCounts.ok} clear words
                  </div>
                  {flagCounts.uncertain > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                      ? {flagCounts.uncertain} uncertain
                    </div>
                  )}
                  {flagCounts.filler > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
                      ✗ {flagCounts.filler} filler words
                    </div>
                  )}
                </div>
              )}

              {/* Tab bar */}
              <div className="flex gap-2 border-b border-white/8 pb-0">
                {(["words", "breakdown", "intonation"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-t-[1rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      activeTab === tab
                        ? "border border-b-transparent border-white/10 bg-slate-950/70 text-cyan-300"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab === "words" ? "📝 Words" : tab === "breakdown" ? "📊 Scores" : "🎵 Intonation"}
                  </button>
                ))}
              </div>

              {/* ─── Tab: Word-level transcript ─── */}
              {activeTab === "words" && (
                <div className="glass-panel rounded-[2rem] p-6" style={{ animation: "fadeUp 0.3s ease both" }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Word-level analysis</p>
                    <button
                      type="button"
                      onClick={() => speakWord(analysis.transcript)}
                      className="flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition"
                      title="Replay full transcript"
                    >
                      🔊 Play all
                    </button>
                  </div>
                  {analysis.word_scores && analysis.word_scores.length > 0 ? (
                    <WordTranscript words={analysis.word_scores} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-8 text-slate-200">
                      {analysis.transcript || "No transcript available."}
                    </p>
                  )}
                </div>
              )}

              {/* ─── Tab: Score breakdown ─── */}
              {activeTab === "breakdown" && (
                <div className="grid gap-4 sm:grid-cols-2" style={{ animation: "fadeUp 0.3s ease both" }}>
                  <div className="glass-panel rounded-[2rem] p-5 space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-1">Pronunciation</p>
                    <ScoreBar label="Clarity" value={analysis.pronunciation.clarity.score} note="Based on transcription confidence signals" />
                    <ScoreBar
                      label="Pace"
                      value={analysis.pronunciation.pace.score}
                      note={analysis.pronunciation.pace.wpm ? `${analysis.pronunciation.pace.wpm.toFixed(0)} WPM (target: 130–170)` : "WPM not available"}
                    />
                    <ScoreBar
                      label="Pauses"
                      value={analysis.pronunciation.pauses.score}
                      note={`${analysis.pronunciation.pauses.pause_count} pauses, ${analysis.pronunciation.pauses.long_pause_count} long`}
                    />
                    <ScoreBar
                      label="Filler words"
                      value={analysis.pronunciation.filler_words.score}
                      note={`${analysis.pronunciation.filler_words.count} detected${analysis.pronunciation.filler_words.examples.length ? ` (${analysis.pronunciation.filler_words.examples.join(", ")})` : ""}`}
                    />
                  </div>
                  <div className="glass-panel rounded-[2rem] p-5 space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-1">Confidence</p>
                    <ScoreBar label="Completeness" value={analysis.confidence.completeness.score} note="Sentence length and idea markers" />
                    <ScoreBar label="Repetition" value={analysis.confidence.repetition.repetition_score}
                      note={analysis.confidence.repetition.repeated_words.length ? `Repeated: ${analysis.confidence.repetition.repeated_words.join(", ")}` : "No major repetition"} />
                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-sm text-slate-200">Word count</p>
                      <p className="text-xl font-black text-white mt-1">{analysis.meta.word_count}</p>
                      {analysis.confidence.short_answer.is_short && (
                        <p className="text-xs text-amber-300 mt-1">Short answer — aim for 40+ words</p>
                      )}
                    </div>
                    {analysis.pronunciation.stress_patterns.targets.length > 0 && (
                      <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                        <p className="text-sm text-slate-200 mb-2">Stress targets</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.pronunciation.stress_patterns.targets.map((t) => (
                            <button key={t} type="button" onClick={() => speakWord(t)}
                              className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition">
                              🔊 {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Tab: Intonation ─── */}
              {activeTab === "intonation" && (
                <div className="glass-panel rounded-[2rem] p-6 space-y-3" style={{ animation: "fadeUp 0.3s ease both" }}>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 mb-2">Intonation coach</p>
                  {analysis.intonation.suggestions.map((item, idx) => (
                    <div key={idx} className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4 text-sm leading-7 text-slate-200">
                      <span className="text-cyan-400 font-semibold mr-2">{idx + 1}.</span>{item}
                    </div>
                  ))}
                  {analysis.intonation.rhythm_markup && (
                    <div className="rounded-[1.5rem] border border-violet-400/15 bg-violet-500/8 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-violet-300 mb-2">Rhythm practice</p>
                      <p className="text-sm leading-8 text-slate-200 font-mono">{analysis.intonation.rhythm_markup}</p>
                      <button
                        type="button"
                        onClick={() => speakWord(analysis.transcript)}
                        className="mt-3 flex items-center gap-1.5 rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/20 transition"
                      >
                        🔊 Hear full sentence
                      </button>
                    </div>
                  )}
                </div>
              )}

            </section>
          )}

        </section>
      </main>
    </>
  );
}
