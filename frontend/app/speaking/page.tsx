"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";

type SpeakingAnalysis = {
  analysis_id: number;
  transcript: string;
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

function scoreLabel(value: number) {
  if (value >= 85) return "Excellent";
  if (value >= 70) return "Strong";
  if (value >= 55) return "Developing";
  return "Needs focus";
}

export default function SpeakingPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [analysis, setAnalysis] = useState<SpeakingAnalysis | null>(null);

  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

    async function loadLatest() {
      setLoadingLatest(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/speaking/latest`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<SpeakingAnalysis>(response);
        setAnalysis(data);
      } catch {
        // Ignore "no analysis" so the page still works as a recorder.
      } finally {
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        audioChunksRef.current = [];
        setAudioUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
      });

      recorder.start();
      setRecording(true);
    } catch {
      setError("Unable to access microphone.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecording(false);
  }

  async function analyzeRecording() {
    if (!token) return;
    const blob = audioBlobRef.current;
    if (!blob) {
      setError("Record a short answer first.");
      return;
    }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speaking analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="glass-panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
            Speaking Excellence
          </p>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h1 className="display text-4xl font-semibold text-white md:text-6xl">
                Pronunciation, intonation, confidence.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-300 md:text-base">
                Record a short answer. We score clarity, pace, pauses, fillers,
                and confidence, then coach sentence stress and tone.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                  href="/portal"
                >
                  Back to portal
                </Link>
                <Link
                  className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                  href="/dashboard"
                >
                  Open dashboard
                </Link>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-6">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                Session
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  className="rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={analyzing}
                >
                  {recording ? "Stop recording" : "Start recording"}
                </button>
                <button
                  className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  type="button"
                  onClick={analyzeRecording}
                  disabled={recording || analyzing}
                >
                  {analyzing ? "Analyzing..." : "Analyze recording"}
                </button>
              </div>

              {audioUrl ? (
                <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Playback
                  </p>
                  <audio className="mt-3 w-full" controls src={audioUrl} />
                </div>
              ) : null}
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

        {loadingLatest && !analysis ? (
          <div className="glass-panel rounded-[2rem] p-6">
            <p className="text-sm text-slate-400">Loading latest analysis...</p>
          </div>
        ) : null}

        {analysis ? (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Scores
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Pronunciation
                    </p>
                    <p className="mt-3 text-4xl font-semibold text-white">
                      {analysis.pronunciation.overall_score.toFixed(1)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {scoreLabel(analysis.pronunciation.overall_score)}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Confidence
                    </p>
                    <p className="mt-3 text-4xl font-semibold text-white">
                      {analysis.confidence.overall_score.toFixed(1)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {scoreLabel(analysis.confidence.overall_score)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Pronunciation breakdown
                </p>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span>Clarity</span>
                      <span>{analysis.pronunciation.clarity.score.toFixed(1)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Based on transcription certainty signals (best-effort).
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span>Pace</span>
                      <span>{analysis.pronunciation.pace.score.toFixed(1)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {analysis.pronunciation.pace.wpm
                        ? `${analysis.pronunciation.pace.wpm.toFixed(1)} WPM`
                        : "WPM not available for this recording."}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span>Pauses</span>
                      <span>{analysis.pronunciation.pauses.score.toFixed(1)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {analysis.pronunciation.pauses.pause_count} pauses,{" "}
                      {analysis.pronunciation.pauses.long_pause_count} long,{" "}
                      {analysis.pronunciation.pauses.silence_gap_count} silence gaps.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span>Filler words</span>
                      <span>{analysis.pronunciation.filler_words.score.toFixed(1)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {analysis.pronunciation.filler_words.count} detected
                      {analysis.pronunciation.filler_words.examples.length
                        ? ` (${analysis.pronunciation.filler_words.examples.join(
                            ", ",
                          )})`
                        : "."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Intonation coach
                </p>
                <div className="mt-5 space-y-3">
                  {analysis.intonation.suggestions.map((item, index) => (
                    <div
                      key={`${index}-${item.slice(0, 14)}`}
                      className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4 text-sm leading-7 text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                {analysis.intonation.rhythm_markup ? (
                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Rhythm practice
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-200">
                      {analysis.intonation.rhythm_markup}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Transcript
                </p>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {analysis.transcript || "Transcript not available."}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
