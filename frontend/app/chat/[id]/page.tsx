"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { readApiData } from "@/lib/api";
import { BackButton } from "@/components/BackButton";

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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [credits, setCredits] = useState(12);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("token") ?? "";
    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadConversation() {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/conversations/${params.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      try {
        const data = await readApiData<Conversation>(response);
        setConversation(data);
        setLoading(false);
      } catch {
        setError("Failed to load conversation history.");
        setLoading(false);
      }
    }

    void loadConversation();
  }, [params.id, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || !token || !conversation) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          content: message,
        }),
      });

      const data = await readApiData<{
        user_message: Message;
        ai_message: Message;
      }>(response);

      setConversation({
        ...conversation,
        messages: [...conversation.messages, data.user_message, data.ai_message],
      });
      setMessage("");
      setRubric(null);
      void playAiReply(data.ai_message);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Message send failed.",
      );
    } finally {
      setSending(false);
    }
  }

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
        void transcribeRecording();
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

  async function transcribeRecording() {
    if (audioChunksRef.current.length === 0) {
      return;
    }

    setTranscribing(true);
    setError("");

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      const transcriptionLanguage =
        conversation?.language === "Spanish"
          ? "es"
          : conversation?.language === "French"
            ? "fr"
            : conversation?.language === "German"
              ? "de"
              : "en";
      formData.append("language", transcriptionLanguage);
      formData.append("prompt", "English conversation practice");

      const response = await fetch(`${API_BASE_URL}/speech/transcribe`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const data = await readApiData<{ text: string }>(response);
      setMessage((currentMessage) =>
        currentMessage
          ? `${currentMessage.trim()} ${data.text}`.trim()
          : data.text,
      );
    } catch (transcriptionError) {
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : "Voice transcription failed.",
      );
    } finally {
      audioChunksRef.current = [];
      setTranscribing(false);
    }
  }

  async function rewriteDraft(mode: string) {
    if (!token || !message.trim()) {
      return;
    }

    setError("");
    setRewritingMode(mode);

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: message, mode }),
      });
      const data = await readApiData<{ mode: string; rewritten_text: string }>(
        response,
      );
      setMessage(data.rewritten_text);
    } catch (rewriteError) {
      setError(
        rewriteError instanceof Error ? rewriteError.message : "Rewrite failed.",
      );
    } finally {
      setRewritingMode(null);
    }
  }

  async function scoreDraft() {
    if (!token || !conversation || !message.trim()) {
      return;
    }

    setError("");
    setScoring(true);

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/rubric`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: message, conversation_id: conversation.id }),
      });
      const data = await readApiData<RubricResponse>(response);
      setRubric(data);
    } catch (scoreError) {
      setError(
        scoreError instanceof Error
          ? scoreError.message
          : "Rubric scoring failed.",
      );
    } finally {
      setScoring(false);
    }
  }

  async function playAiReply(aiMessage: Message) {
    setError("");
    setSpeakingMessageId(aiMessage.id);

    try {
      const response = await fetch(`${API_BASE_URL}/speech/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: aiMessage.content }),
      });

      if (!response.ok) {
        throw new Error("AI voice playback failed.");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(audioUrl);
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
        setSpeakingMessageId((currentId) =>
          currentId === aiMessage.id ? null : currentId,
        );
      });

      audio.addEventListener("error", () => {
        URL.revokeObjectURL(audioUrl);
        setSpeakingMessageId(null);
        setError("AI voice playback failed.");
      });

      await audio.play();
    } catch (speechError) {
      setSpeakingMessageId(null);
      setError(
        speechError instanceof Error
          ? speechError.message
          : "AI voice playback failed.",
      );
    }
  }

  return (
    <main className="app-shell grid-overlay relative overflow-hidden px-5 py-6 text-slate-100 md:px-8 md:py-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass-panel flex flex-col rounded-[2rem] p-6">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/80">
            Live workspace
          </p>
          <h1 className="display mt-4 text-4xl font-semibold text-white">
            Conversation #{params.id}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Run a realistic voice-enabled session with transcription, AI
            playback, and message history stored automatically.
          </p>

          <div className="mt-8 space-y-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Language
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                {conversation?.language ?? "Loading"}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Status
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                {conversation?.status ?? "Pending"}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Credits
                </p>
                <span className="text-xs text-cyan-300 font-medium">🔥 {credits} / 20</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)] transition-all duration-500"
                  style={{ width: `${(credits / 20) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-8">
            <BackButton fallbackHref="/portal" label="Back" />
            <Link
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
              href="/portal"
            >
              Change scenario
            </Link>
            <Link
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
              href="/dashboard"
            >
              Open dashboard
            </Link>
          </div>
        </aside>

        <section className="glass-panel flex min-h-[70vh] flex-col rounded-[2rem] p-4 md:p-5">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-2 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">
                AI interview stream
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Real-time conversation
              </h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
              {recording
                ? "Recording"
                : transcribing
                  ? "Transcribing"
                  : sending
                    ? "Responding"
                    : "Ready"}
            </div>
          </div>

          <div className="scrollbar-subtle flex-1 space-y-4 overflow-y-auto px-2 py-6">
            {!token ? (
              <p className="rounded-[1.25rem] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                No auth token found. Return to the home page and log in first.
              </p>
            ) : null}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className="h-20 w-[60%] animate-pulse rounded-[1.6rem] bg-white/5 border border-white/10" />
                  </div>
                ))}
                <p className="text-center text-sm text-slate-500 animate-pulse">Loading conversation history...</p>
              </div>
            ) : null}

            {conversation?.messages.map((entry) => (
              <div
                key={entry.id}
                className={`max-w-[88%] rounded-[1.6rem] border px-4 py-4 text-sm leading-7 shadow-xl ${
                  entry.sender_role === "user"
                    ? "ml-auto border-cyan-200/30 bg-[linear-gradient(135deg,rgba(105,226,255,0.95),rgba(167,243,208,0.78))] text-slate-950"
                    : "border-white/10 bg-[rgba(7,16,29,0.86)] text-slate-100"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">
                      {entry.sender_role === "user" ? "You" : "AI coach"}
                    </p>
                    <p className="mt-1 text-[11px] opacity-55">
                      {formatTimestamp(entry.created_at)}
                    </p>
                  </div>
                  {entry.sender_role === "assistant" ? (
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] opacity-80 transition hover:border-cyan-300/50 hover:opacity-100"
                      onClick={() => void playAiReply(entry)}
                      type="button"
                    >
                      {speakingMessageId === entry.id ? "Playing" : "Play voice"}
                    </button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap">{entry.content}</p>
              </div>
            ))}

            <div ref={messagesEndRef} />

            {conversation && conversation.messages.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/25 px-5 py-6 text-sm text-slate-400">
                No messages yet. Send the first one to start the conversation.
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mb-4 rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <form
            className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 px-3 py-3"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                className={`rounded-[1.25rem] border px-4 py-3 text-sm font-medium transition ${
                  recording
                    ? "border-rose-300/40 bg-rose-500/20 text-rose-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/50 hover:text-white"
                }`}
                onClick={recording ? stopRecording : () => void startRecording()}
                type="button"
              >
                {recording ? "Stop" : transcribing ? "Transcribing..." : "Record"}
              </button>
              <input
                className="min-w-0 flex-1 rounded-[1.25rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-300/40"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type or dictate your message..."
                value={message}
              />
              <button
                className="rounded-[1.25rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-3 font-medium text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  sending ||
                  transcribing ||
                  !message.trim() ||
                  !conversation ||
                  !token ||
                  credits === 0
                }
                type="submit"
              >
                {sending ? "Sending..." : credits === 0 ? "❌ No credits" : "Send"}
              </button>
            </div>

            {credits === 0 && (
              <p className="mt-2 text-center text-xs text-rose-300">
                ❌ No credits left. Come back tomorrow
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-200 transition hover:border-cyan-300/50 disabled:opacity-50"
                type="button"
                onClick={() => void rewriteDraft("make natural")}
                disabled={sending || transcribing || !message.trim() || !token || !conversation || !!error}
              >
                {rewritingMode === "make natural" ? "Rewriting..." : "Make natural"}
              </button>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-200 transition hover:border-cyan-300/50 disabled:opacity-50"
                type="button"
                onClick={() => void rewriteDraft("make professional")}
                disabled={sending || transcribing || !message.trim() || !token || !conversation || !!error}
              >
                {rewritingMode === "make professional"
                  ? "Rewriting..."
                  : "Make professional"}
              </button>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-200 transition hover:border-cyan-300/50 disabled:opacity-50"
                type="button"
                onClick={() => void rewriteDraft("make advanced")}
                disabled={sending || transcribing || !message.trim() || !token || !conversation || !!error}
              >
                {rewritingMode === "make advanced" ? "Rewriting..." : "Make advanced"}
              </button>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-200 transition hover:border-cyan-300/50 disabled:opacity-50"
                type="button"
                onClick={() => void rewriteDraft("make shorter")}
                disabled={sending || transcribing || !message.trim() || !token || !conversation || !!error}
              >
                {rewritingMode === "make shorter" ? "Rewriting..." : "Make shorter"}
              </button>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-200 transition hover:border-cyan-300/50 disabled:opacity-50"
                type="button"
                onClick={() => void rewriteDraft("make interview-ready")}
                disabled={sending || transcribing || !message.trim() || !token || !conversation || !!error}
              >
                {rewritingMode === "make interview-ready"
                  ? "Rewriting..."
                  : "Make interview-ready"}
              </button>

              <span className="mx-1 h-5 w-px bg-white/10" />

              <button
                className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100 transition hover:border-cyan-300/50 disabled:opacity-50"
                type="button"
                onClick={() => void scoreDraft()}
                disabled={sending || transcribing || scoring || !message.trim() || !token || !conversation || !!error}
              >
                {scoring ? "Scoring..." : "Score quality"}
              </button>
            </div>
          </form>

          {rubric ? (
            <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-slate-950/35 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                    Answer quality rubric
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Overall score:{" "}
                    <span className="font-semibold text-white">
                      {rubric.overall_score.toFixed(1)}
                    </span>
                    {rubric.question ? (
                      <span className="text-slate-400"> (prompt detected)</span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {Object.entries(rubric.scores).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-[1.25rem] border border-white/10 bg-slate-950/45 px-4 py-3"
                  >
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="capitalize">{key}</span>
                      <span>{value.toFixed(1)}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/8">
                      <div
                        className="h-2 rounded-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)]"
                        style={{ width: `${Math.max(6, Math.min(value, 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-slate-950/45 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Next actions
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {rubric.action_items.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
