"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════
   AI SPEAKING PARTNER — free conversation, no scenario
   ═══════════════════════════════════════════════════════════ */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Topic = { id: string; emoji: string; label: string; seed: string };
type PersonalityStyle = { id: string; emoji: string; label: string; description: string };

const TOPICS: Topic[] = [
  { id: "none",      emoji: "🎲", label: "Surprise me",    seed: "Start with whatever topic feels natural." },
  { id: "life",      emoji: "😊", label: "Daily life",     seed: "Start by asking about the user's typical day." },
  { id: "travel",    emoji: "🌍", label: "Travel",         seed: "Start by asking about a place the user has visited or wants to visit." },
  { id: "culture",   emoji: "🎭", label: "Culture & food", seed: "Start by asking about the user's favourite food or cultural tradition." },
  { id: "work",      emoji: "💼", label: "Work & career",  seed: "Start by asking what the user does for work and what they enjoy about it." },
  { id: "films",     emoji: "🎬", label: "Films & series", seed: "Start by asking what the user is currently watching." },
  { id: "sports",    emoji: "⚽", label: "Sports",         seed: "Start by asking if the user plays or follows any sport." },
  { id: "news",      emoji: "📰", label: "Current events", seed: "Start by asking what the user recently found interesting in the news." },
  { id: "dreams",    emoji: "💭", label: "Dreams & goals", seed: "Start by asking about the user's biggest goal right now." },
];

const PERSONALITIES: PersonalityStyle[] = [
  {
    id: "friend",
    emoji: "😄",
    label: "Friendly",
    description: "Warm, casual, uses humour. Like talking to a native English-speaking friend.",
  },
  {
    id: "coach",
    emoji: "🎓",
    label: "Language Coach",
    description: "Asks follow-up questions to push longer answers. Gently highlights weak vocabulary.",
  },
  {
    id: "intellectual",
    emoji: "🧠",
    label: "Intellectual",
    description: "Deep, thought-provoking questions. Challenges your opinion. Uses advanced vocabulary.",
  },
];

type ScenarioItem = { id: number };

function buildFreeflowPrompt(
  topic: Topic,
  personality: PersonalityStyle,
  correction: string,
  targetMinutes: number,
): string {
  const personalityDesc: Record<string, string> = {
    friend: `Be like a genuine English-speaking friend — warm, funny, curious. Use contractions, slang, and natural filler words ("yeah", "I mean", "right?"). React emotionally to what the user shares.`,
    coach: `Act as a supportive English language coach having a real conversation. After every 2-3 user messages, briefly and naturally note one vocabulary upgrade (e.g., "By the way, instead of 'very tired' you could say 'exhausted' — anyway, continuing..."). Ask follow-up questions to encourage longer answers.`,
    intellectual: `Be an intellectually curious conversationalist. Ask deep "why" and "what do you think about..." questions. Use sophisticated vocabulary naturally. Offer your own perspective to invite debate.`,
  };

  const correctionMode: Record<string, string> = {
    no_interruption: "Do NOT correct grammar at all. Just have a natural conversation.",
    delayed: "Every 4-5 messages, step out naturally to offer one grammar tip in brackets [Tip: ...], then continue.",
    correct_every_answer: "After each user message, if there is a grammar error, note it immediately in brackets [Correction: ..., Better: ...], then respond naturally.",
  };

  return `You are an AI speaking partner having a completely free, natural English conversation.

PERSONALITY: ${personalityDesc[personality.id] ?? personalityDesc.friend}

TOPIC SEED: ${topic.seed}

CONVERSATION GOAL: Have a genuine, engaging conversation for approximately ${targetMinutes} minutes. Keep the user talking by asking open-ended follow-up questions. Move naturally between subtopics — don't stick to just one.

GRAMMAR CORRECTION: ${correctionMode[correction] ?? correctionMode.delayed}

CRITICAL RULES:
- Never say "As an AI..." or "I don't have feelings..." — just engage naturally
- Keep responses concise (2-4 sentences) to leave room for the user to talk
- Show genuine curiosity — ask about specifics, not generic questions
- If the user gives a one-word answer, gently challenge them: "Tell me more about that!"
- This is a speaking practice session, so encourage the user to express themselves fully

Start the conversation now with your opening message.`;
}

export default function FreflowPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);

  const [selectedTopic, setSelectedTopic] = useState<Topic>(TOPICS[0]);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityStyle>(PERSONALITIES[0]);
  const [correction, setCorrection] = useState("delayed");
  const [targetMinutes, setTargetMinutes] = useState(10);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
    fetch(`${API_BASE_URL}/scenarios`).then((r) => r.json()).then((d) => {
      const items: ScenarioItem[] = Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.items) ? d.data.items : [];
      setScenarios(items);
    }).catch(() => {});
  }, [router]);

  async function startSession() {
    if (!token || scenarios.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const prompt = buildFreeflowPrompt(selectedTopic, selectedPersonality, correction, targetMinutes);
      const res = await fetch(`${API_BASE_URL}/conversations/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scenario_id: scenarios[0].id,
          language: "English",
          custom_title: `Free Talk: ${selectedTopic.label} with ${selectedPersonality.label}`,
          custom_prompt: prompt,
          correction_mode: correction,
        }),
      });
      const data = await readApiData<{ id: number }>(res);
      router.push(`/chat/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session.");
      setStarting(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .anim { animation: fadeUp 0.4s ease both; }
        .anim-1 { animation-delay: .07s }
        .anim-2 { animation-delay: .14s }
        .anim-3 { animation-delay: .21s }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-8 text-slate-100 md:px-6">
        <div className="mx-auto max-w-xl flex flex-col gap-6">

          {/* Header */}
          <div className="anim flex items-center justify-between">
            <div>
              <p className="ds-label ds-label-primary mb-1">🗣️ AI Speaking Partner</p>
              <h1 className="text-2xl font-black text-white">Talk Freely</h1>
              <p className="text-sm text-slate-400 mt-1">No scenario. No pressure. Just speak.</p>
            </div>
            <Link href="/modes" className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-pill">← Modes</Link>
          </div>

          {error && <div className="ds-card-danger rounded-[1.75rem] px-4 py-3 text-sm">❌ {error}</div>}

          {/* Topic */}
          <div className="anim anim-1">
            <p className="ds-label mb-3">What do you want to talk about?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOPICS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className={`rounded-[1.5rem] border px-3 py-3 text-center text-xs transition ${
                    selectedTopic.id === t.id
                      ? "border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)]"
                      : "border-white/8 bg-white/3 text-slate-400 hover:border-white/15 hover:text-white"
                  }`}
                  style={{ animation: `fadeUp 0.3s ease ${i * 0.03}s both` }}
                  onClick={() => setSelectedTopic(t)}
                >
                  <div className="text-xl mb-1">{t.emoji}</div>
                  <div className="font-semibold leading-4">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div className="anim anim-2">
            <p className="ds-label mb-3">Partner personality</p>
            <div className="grid gap-2">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rounded-[1.5rem] border p-4 text-left flex items-center gap-3 transition ${
                    selectedPersonality.id === p.id
                      ? "border-[var(--primary-border)] bg-[var(--primary-bg)]"
                      : "border-white/8 bg-white/3 hover:border-white/15"
                  }`}
                  onClick={() => setSelectedPersonality(p)}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{p.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-5">{p.description}</p>
                  </div>
                  {selectedPersonality.id === p.id && <span className="text-emerald-400">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="anim anim-3 ds-card-flat rounded-[1.75rem] space-y-4">
            {/* Duration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="ds-label">Session length</p>
                <span className="text-sm font-bold text-white">{targetMinutes} min</span>
              </div>
              <input
                type="range" min={5} max={30} step={5}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>5 min</span><span>30 min</span>
              </div>
            </div>

            {/* Grammar correction */}
            <div>
              <p className="ds-label mb-2">Grammar correction</p>
              <div className="grid gap-2">
                {[
                  { id: "no_interruption", label: "No corrections", desc: "Fully immersive" },
                  { id: "delayed",         label: "Gentle hints",   desc: "Every few messages" },
                  { id: "correct_every_answer", label: "Instant",  desc: "Every message" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`flex items-center gap-3 rounded-[1.2rem] border px-3 py-2.5 text-sm text-left transition ${
                      correction === opt.id
                        ? "border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)]"
                        : "border-white/8 text-slate-400 hover:border-white/15 hover:text-white"
                    }`}
                    onClick={() => setCorrection(opt.id)}
                  >
                    <span className="flex-1 font-medium">{opt.label}</span>
                    <span className="text-xs text-slate-500">{opt.desc}</span>
                    {correction === opt.id && <span className="text-emerald-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary + CTA */}
          <div className="ds-card-primary rounded-[1.75rem] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-white">
                {selectedTopic.emoji} {selectedTopic.label} · {selectedPersonality.emoji} {selectedPersonality.label}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{targetMinutes} min session · {
                correction === "no_interruption" ? "No corrections" :
                correction === "delayed" ? "Gentle hints" : "Instant corrections"
              }</p>
            </div>
          </div>

          <button
            className="ds-btn ds-btn-primary ds-btn-pill ds-btn-xl w-full"
            onClick={() => void startSession()}
            disabled={starting || scenarios.length === 0}
            type="button"
          >
            {starting ? <span className="ds-btn-spinner" /> : "🗣️ Start Talking →"}
          </button>

        </div>
      </main>
    </>
  );
}
