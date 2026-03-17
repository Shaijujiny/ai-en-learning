"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════
   REAL LIFE MODE — situational practice
   ═══════════════════════════════════════════════════════════ */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Situation = {
  id: string;
  emoji: string;
  title: string;
  setting: string;
  role: string;        // what the AI plays
  description: string;
  gradient: string;
  border: string;
  starter: string;     // AI's opening line
};

const SITUATIONS: Situation[] = [
  {
    id: "airport",
    emoji: "✈️",
    title: "Airport Check-in",
    setting: "International Airport, Departure Hall",
    role: "airline check-in staff",
    description: "Check in for your flight, deal with overweight luggage, ask about your seat.",
    gradient: "from-sky-600/20 to-blue-700/12",
    border: "border-sky-400/20",
    starter: "Good morning! Next in line, please. May I see your passport and booking reference?",
  },
  {
    id: "office",
    emoji: "🏢",
    title: "First Day at Work",
    setting: "Modern Office, Monday morning",
    role: "friendly colleague Sarah",
    description: "Meet your new teammate, learn about the team, find your desk, ask HR questions.",
    gradient: "from-violet-600/20 to-purple-700/12",
    border: "border-violet-400/20",
    starter: "Oh! You must be the new person. Hi, I'm Sarah — welcome! Can I show you around the office?",
  },
  {
    id: "doctor",
    emoji: "🏥",
    title: "Doctor's Appointment",
    setting: "GP Clinic, Consultation Room",
    role: "doctor",
    description: "Describe your symptoms, ask questions about medication, understand your diagnosis.",
    gradient: "from-rose-600/18 to-pink-700/12",
    border: "border-rose-400/20",
    starter: "Come in, have a seat. So what brings you in today? Tell me about your symptoms.",
  },
  {
    id: "restaurant",
    emoji: "🍽️",
    title: "Restaurant Order",
    setting: "Upscale Restaurant",
    role: "waiter",
    description: "Order food, ask about ingredients, deal with dietary restrictions, handle the bill.",
    gradient: "from-amber-600/20 to-orange-700/12",
    border: "border-amber-400/20",
    starter: "Good evening! Welcome to La Maison. I'm your server tonight. Can I start you off with some drinks?",
  },
  {
    id: "landlord",
    emoji: "🏠",
    title: "Talking to Your Landlord",
    setting: "Your apartment",
    role: "landlord",
    description: "Report a problem, request repairs, ask about lease terms, handle rent discussion.",
    gradient: "from-emerald-600/20 to-teal-700/12",
    border: "border-emerald-400/20",
    starter: "Hello! I got your message about the issue with the apartment. What exactly is the problem?",
  },
  {
    id: "shopping",
    emoji: "🛍️",
    title: "Shopping & Returns",
    setting: "Department Store",
    role: "store assistant",
    description: "Find items, ask sizes, negotiate, make a return with a tricky receipt situation.",
    gradient: "from-yellow-600/20 to-amber-700/12",
    border: "border-yellow-400/20",
    starter: "Hello! Can I help you find anything today? Are you looking for something in particular?",
  },
  {
    id: "customer",
    emoji: "📞",
    title: "Customer Support Call",
    setting: "Phone call with a company",
    role: "customer support agent",
    description: "Complain about a product, escalate to a manager, get a refund. High stakes English.",
    gradient: "from-cyan-600/20 to-blue-700/12",
    border: "border-cyan-400/20",
    starter: "Thank you for calling TechCorp support. This is James speaking. How can I assist you today?",
  },
  {
    id: "date",
    emoji: "☕",
    title: "Coffee & Small Talk",
    setting: "Coffee shop / casual social setting",
    role: "friendly new acquaintance",
    description: "Make small talk naturally, share interests, keep a conversation flowing without awkward silence.",
    gradient: "from-pink-600/18 to-rose-700/12",
    border: "border-pink-400/20",
    starter: "This place has the best flat whites, right? Are you here often? I've never seen you before.",
  },
];

type ScenarioItem = { id: number };

function buildRealLifePrompt(situation: Situation, correction: string): string {
  return `You are playing the role of a ${situation.role} in a real-life situation.

SETTING: ${situation.setting}

YOUR CHARACTER: ${situation.role}. Stay in character throughout. Speak naturally — not like an AI, but like a real person in this situation.

YOUR OPENING LINE (say this first, exactly): "${situation.starter}"

RULES:
1. Always stay in character as the ${situation.role}
2. React naturally to what the user says — be surprised, helpful, annoyed, or friendly as the situation calls for
3. Use realistic, everyday English — contractions, filler words, interruptions are fine
4. If the user says something unclear, misunderstand it naturally (don't say "as an AI...")
5. Move the situation forward realistically
6. After 10–15 exchanges, wrap up the scenario naturally

ENGLISH CORRECTION MODE: ${correction === "no_interruption" ? "Do not correct grammar. Stay in character." : correction === "delayed" ? "After every 3 user messages, step out of character briefly to note one grammar improvement, then resume." : "After each user message, if there is a grammar error, gently note it in brackets like [Tip: say X instead of Y] then continue the scene."}

Begin with your opening line now.`;
}

export default function RealLifePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [selected, setSelected] = useState<Situation | null>(null);
  const [correction, setCorrection] = useState("delayed");
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
    if (!token || !selected || scenarios.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scenario_id: scenarios[0].id,
          language: "English",
          custom_title: `Real Life: ${selected.title}`,
          custom_prompt: buildRealLifePrompt(selected, correction),
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
        .anim-1 { animation-delay:.06s }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-8 text-slate-100 md:px-6">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">

          <div className="anim flex items-center justify-between">
            <div>
              <p className="ds-label ds-label-accent mb-1">🌍 Real Life Mode</p>
              <h1 className="text-2xl font-black text-white">Choose a Situation</h1>
              <p className="text-sm text-slate-400 mt-1">AI plays the other person — fully in character.</p>
            </div>
            <Link href="/modes" className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-pill">← Modes</Link>
          </div>

          {error && (
            <div className="ds-card-danger rounded-[1.75rem] px-4 py-3 text-sm">❌ {error}</div>
          )}

          {/* Situation grid */}
          <div className="anim anim-1 grid gap-3 sm:grid-cols-2">
            {SITUATIONS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`rounded-[1.75rem] border p-4 text-left transition hover:-translate-y-0.5 ${
                  selected?.id === s.id
                    ? `${s.border} bg-gradient-to-br ${s.gradient}`
                    : "border-white/8 bg-white/3 hover:border-white/15"
                }`}
                style={{ animation: `fadeUp 0.35s ease ${i * 0.04}s both` }}
                onClick={() => setSelected(s)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl">{s.emoji}</span>
                  {selected?.id === s.id && <span className="text-emerald-400 text-sm mt-0.5">✓</span>}
                </div>
                <p className="text-sm font-bold text-white mt-2">{s.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.setting}</p>
                <p className="text-xs text-slate-400 leading-5 mt-2">{s.description}</p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="anim space-y-4">
              {/* Correction mode */}
              <div className="ds-card-flat rounded-[1.75rem]">
                <p className="ds-label mb-3">Grammar correction style</p>
                <div className="grid gap-2">
                  {[
                    { id: "no_interruption", label: "No corrections", desc: "Stay fully immersed in the scene" },
                    { id: "delayed",         label: "Gentle hints", desc: "Tip after every 3 messages" },
                    { id: "correct_every_answer", label: "Instant corrections", desc: "Corrects every error immediately" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`flex items-center gap-3 rounded-[1.3rem] border px-4 py-3 text-left text-sm transition ${
                        correction === opt.id
                          ? "border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)]"
                          : "border-white/8 bg-white/3 text-slate-300 hover:border-white/15"
                      }`}
                      onClick={() => setCorrection(opt.id)}
                    >
                      <span className="flex-1">
                        <span className="font-semibold block">{opt.label}</span>
                        <span className="text-xs text-slate-500">{opt.desc}</span>
                      </span>
                      {correction === opt.id && <span className="text-emerald-400">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className={`rounded-[1.75rem] border bg-gradient-to-br ${selected.gradient} ${selected.border} p-4`}>
                <p className="text-xs text-slate-500 mb-1.5">AI will open with:</p>
                <p className="text-sm text-slate-200 italic leading-6">&ldquo;{selected.starter}&rdquo;</p>
              </div>

              <button
                className="ds-btn ds-btn-accent ds-btn-pill ds-btn-lg w-full"
                onClick={() => void startSession()}
                disabled={starting || scenarios.length === 0}
                type="button"
              >
                {starting ? <span className="ds-btn-spinner" /> : `${selected.emoji} Enter ${selected.title} →`}
              </button>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
