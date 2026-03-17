"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

/* ═══════════════════════════════════════════════════════════
   INTERVIEW MODE AI
   Real company-style interviews with follow-up pressure
   ═══════════════════════════════════════════════════════════ */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ─── Company presets ─── */
type Company = {
  id: string;
  name: string;
  logo: string;
  sector: string;
  style: string;
  color: string;
};

const COMPANIES: Company[] = [
  { id: "google",   name: "Google",    logo: "🔍", sector: "Tech",       style: "Behavioral + problem-solving with structured STAR format", color: "from-blue-500/20 to-cyan-500/10" },
  { id: "amazon",   name: "Amazon",    logo: "📦", sector: "Tech",       style: "Leadership Principles deep-dives — expect follow-ups on every answer", color: "from-amber-500/20 to-orange-500/10" },
  { id: "mckinsey", name: "McKinsey",  logo: "📊", sector: "Consulting", style: "Case-study + structured communication under time pressure", color: "from-blue-700/20 to-indigo-500/10" },
  { id: "goldman",  name: "Goldman Sachs", logo: "💰", sector: "Finance", style: "Technical finance + stress testing with rapid-fire follow-ups", color: "from-yellow-500/20 to-amber-500/10" },
  { id: "apple",    name: "Apple",     logo: "🍎", sector: "Tech",       style: "Design thinking + culture fit, expects precise concise answers", color: "from-slate-500/20 to-slate-600/10" },
  { id: "startup",  name: "Startup",   logo: "🚀", sector: "Startup",   style: "Casual but high-stakes — role breadth, adaptability, ownership", color: "from-violet-500/20 to-purple-500/10" },
  { id: "ngo",      name: "NGO / UN",  logo: "🌍", sector: "Non-profit", style: "Mission-driven, ethical reasoning, collaborative stories", color: "from-emerald-500/20 to-green-500/10" },
  { id: "custom",   name: "Custom",    logo: "✍️", sector: "Any",        style: "Define your own company and interview style", color: "from-white/5 to-white/3" },
];

/* ─── Role presets ─── */
const ROLES = [
  "Software Engineer", "Product Manager", "Data Analyst", "Marketing Manager",
  "UX Designer", "Business Analyst", "Sales Executive", "Finance Analyst",
  "Operations Manager", "HR Manager", "Custom role…",
];

/* ─── Pressure levels ─── */
type PressureLevel = "relaxed" | "normal" | "pressure";

const PRESSURE_CONFIG: Record<PressureLevel, {
  label: string; icon: string; description: string;
  border: string; bg: string; textColor: string;
}> = {
  relaxed: {
    label: "Relaxed",
    icon: "😌",
    description: "Friendly tone. Good for beginners.",
    border: "border-emerald-300/25", bg: "bg-emerald-500/8", textColor: "text-emerald-300",
  },
  normal: {
    label: "Normal",
    icon: "🎯",
    description: "Professional interview pace.",
    border: "border-cyan-300/25", bg: "bg-cyan-500/8", textColor: "text-cyan-300",
  },
  pressure: {
    label: "Pressure Mode 🔥",
    icon: "🔥",
    description: "Tough follow-ups. Silence pushes. Real recruiter feel.",
    border: "border-rose-300/25", bg: "bg-rose-500/8", textColor: "text-rose-300",
  },
};

/* ─── Question types ─── */
const QUESTION_TYPES = [
  { id: "behavioral",  label: "Behavioral", icon: "💬", desc: "Tell me about a time when…" },
  { id: "technical",   label: "Technical",  icon: "🧠", desc: "Problem-solving, domain knowledge" },
  { id: "situational", label: "Situational",icon: "🎭", desc: "What would you do if…" },
  { id: "mixed",       label: "Mixed",      icon: "🔀", desc: "All types, like a real interview" },
];

function buildSystemPrompt(opts: {
  company: Company;
  role: string;
  pressure: PressureLevel;
  questionType: string;
  customCompany?: string;
}) {
  const { company, role, pressure, questionType, customCompany } = opts;
  const companyName = company.id === "custom" ? (customCompany || "a company") : company.name;

  const pressureInstructions: Record<PressureLevel, string> = {
    relaxed: "Use a warm, encouraging tone. Give hints if the candidate struggles. Praise good answers.",
    normal: "Use a professional, neutral tone. Ask clarifying follow-up questions normally.",
    pressure: `Use a tough, direct recruiter tone. After every answer:
1. Ask at least one probing follow-up (e.g. "Can you be more specific?" / "What would you do differently?" / "Why didn't you...?")
2. Challenge weak answers directly
3. Simulate time pressure: if the answer is too long, say "Let me stop you there — what was the outcome?"
4. Never compliment. Only give feedback if asked.`,
  };

  const qtInstructions: Record<string, string> = {
    behavioral:  "Focus exclusively on behavioral questions using the STAR method (Situation, Task, Action, Result). Always ask follow-ups about the Result.",
    technical:   `Focus on technical and domain-specific questions for the ${role} role. Test depth of knowledge.`,
    situational: "Focus on hypothetical situational questions. Evaluate the candidate's reasoning process.",
    mixed:       "Rotate between behavioral, technical, and situational questions as a real interview would.",
  };

  return `You are a senior recruiter at ${companyName} conducting a real job interview for the role of "${role}".

INTERVIEW STYLE: ${company.style}

PRESSURE LEVEL: ${pressureInstructions[pressure]}

QUESTION TYPE: ${qtInstructions[questionType] ?? qtInstructions.mixed}

CRITICAL RULES:
- Stay strictly in character as an interviewer. Never break character.
- Start immediately: greet the candidate briefly and ask your first interview question.
- After each answer, either ask a follow-up OR move to the next question.
- Keep track of weak answers and return to challenge them later.
- End the interview after 6–8 questions with a brief closing ("We'll be in touch.").
- Do NOT give coaching, tips, or explanations during the interview itself.
- Evaluate: clarity, structure, confidence, relevance, and depth.

Begin the interview now.`;
}

type Scenario = { id: number; title: string };

export default function InterviewPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  /* Config state */
  const [selectedCompany, setSelectedCompany] = useState<Company>(COMPANIES[0]);
  const [customCompany, setCustomCompany] = useState("");
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [customRole, setCustomRole] = useState("");
  const [pressure, setPressure] = useState<PressureLevel>("normal");
  const [questionType, setQuestionType] = useState("mixed");

  /* UI state */
  const [step, setStep] = useState<"company" | "role" | "settings" | "ready">("company");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);

    // Load scenarios to get a base scenario_id (we use custom_prompt anyway)
    fetch(`${API_BASE_URL}/scenarios`)
      .then((r) => r.json())
      .then((d) => {
        const items: Scenario[] = Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.items) ? d.data.items : [];
        setScenarios(items);
      })
      .catch(() => {});
  }, [router]);

  const finalRole = selectedRole === "Custom role…" ? customRole : selectedRole;
  const finalCompany = selectedCompany.id === "custom" ? customCompany || "Custom Company" : selectedCompany.name;

  async function startInterview() {
    if (!token || scenarios.length === 0) return;
    setStarting(true);
    setError("");
    try {
      const prompt = buildSystemPrompt({
        company: selectedCompany,
        role: finalRole,
        pressure,
        questionType,
        customCompany,
      });
      const res = await fetch(`${API_BASE_URL}/conversations/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scenario_id: scenarios[0].id,
          language: "English",
          custom_title: `${finalCompany} — ${finalRole} Interview`,
          custom_prompt: prompt,
          correction_mode: "major_mistakes_only",
        }),
      });
      const data = await readApiData<{ id: number }>(res);
      router.push(`/chat/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start interview.");
      setStarting(false);
    }
  }

  const pressureCfg = PRESSURE_CONFIG[pressure];

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .anim { animation: fadeUp 0.4s ease both; }
        .anim-1 { animation-delay:.06s } .anim-2 { animation-delay:.12s }
        .anim-3 { animation-delay:.18s } .anim-4 { animation-delay:.24s }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-8 text-slate-100 md:px-6">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">

          {/* Header */}
          <div className="anim flex items-center justify-between">
            <div>
              <p className="ds-label ds-label-primary mb-1">🎤 Interview Mode AI</p>
              <h1 className="text-2xl font-black text-white">Set Up Your Interview</h1>
            </div>
            <Link href="/modes" className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-pill">← Modes</Link>
          </div>

          {error && (
            <div className="ds-card-danger rounded-[1.75rem] px-4 py-3 text-sm flex justify-between items-start gap-3">
              <span>❌ {error}</span>
              <button className="text-xs opacity-60 hover:opacity-100" onClick={() => setError("")} type="button">✕</button>
            </div>
          )}

          {/* Progress steps */}
          <div className="anim anim-1 flex items-center gap-2">
            {(["company", "role", "settings", "ready"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <button
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    s === step ? "bg-[var(--primary-gradient)] text-slate-950" :
                    ["company","role","settings","ready"].indexOf(s) < ["company","role","settings","ready"].indexOf(step)
                      ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-slate-500"
                  }`}
                  onClick={() => setStep(s)}
                  type="button"
                  style={s === step ? { background: "var(--primary-gradient)" } : {}}
                >
                  {i + 1}
                </button>
                {i < 3 && <div className="flex-1 h-px bg-white/10" />}
              </div>
            ))}
          </div>

          {/* ── STEP 1: Company ── */}
          {step === "company" && (
            <div className="anim anim-2 space-y-4">
              <p className="ds-label">Step 1 — Choose your company</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {COMPANIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`rounded-[1.75rem] border p-4 text-left transition hover:-translate-y-0.5 ${
                      selectedCompany.id === c.id
                        ? "border-[var(--primary-border)] bg-gradient-to-br " + c.color
                        : "border-white/8 bg-white/3 hover:border-white/15"
                    }`}
                    onClick={() => setSelectedCompany(c)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{c.logo}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.sector}</p>
                      </div>
                      {selectedCompany.id === c.id && (
                        <span className="ml-auto text-emerald-400 text-base">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-5 line-clamp-2">{c.style}</p>
                  </button>
                ))}
              </div>
              {selectedCompany.id === "custom" && (
                <input
                  className="ds-input"
                  placeholder="Company name…"
                  value={customCompany}
                  onChange={(e) => setCustomCompany(e.target.value)}
                />
              )}
              <button
                className="ds-btn ds-btn-primary ds-btn-pill w-full ds-btn-lg"
                onClick={() => setStep("role")}
                disabled={selectedCompany.id === "custom" && !customCompany.trim()}
                type="button"
              >
                Next: Choose role →
              </button>
            </div>
          )}

          {/* ── STEP 2: Role ── */}
          {step === "role" && (
            <div className="anim anim-2 space-y-4">
              <p className="ds-label">Step 2 — Choose your role</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rounded-[1.5rem] border px-4 py-3 text-sm text-left transition ${
                      selectedRole === r
                        ? "border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)]"
                        : "border-white/8 bg-white/3 text-slate-300 hover:border-white/15"
                    }`}
                    onClick={() => setSelectedRole(r)}
                  >
                    {r}
                    {selectedRole === r && <span className="float-right text-emerald-400">✓</span>}
                  </button>
                ))}
              </div>
              {selectedRole === "Custom role…" && (
                <input
                  className="ds-input"
                  placeholder="e.g. Senior Backend Engineer"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                />
              )}
              <div className="flex gap-3">
                <button className="ds-btn ds-btn-ghost ds-btn-pill flex-1" onClick={() => setStep("company")} type="button">← Back</button>
                <button
                  className="ds-btn ds-btn-primary ds-btn-pill flex-1"
                  onClick={() => setStep("settings")}
                  disabled={selectedRole === "Custom role…" && !customRole.trim()}
                  type="button"
                >Next: Settings →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Pressure + Question type ── */}
          {step === "settings" && (
            <div className="anim anim-2 space-y-5">
              <p className="ds-label">Step 3 — Configure the interview</p>

              {/* Pressure level */}
              <div>
                <p className="text-xs text-slate-400 mb-3">Pressure level</p>
                <div className="grid gap-3">
                  {(Object.entries(PRESSURE_CONFIG) as [PressureLevel, typeof PRESSURE_CONFIG.normal][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      className={`rounded-[1.75rem] border p-4 text-left flex items-center gap-4 transition ${
                        pressure === key ? `${cfg.border} ${cfg.bg}` : "border-white/8 bg-white/3 hover:border-white/15"
                      }`}
                      onClick={() => setPressure(key)}
                    >
                      <span className="text-2xl flex-shrink-0">{cfg.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${pressure === key ? cfg.textColor : "text-white"}`}>{cfg.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{cfg.description}</p>
                      </div>
                      {pressure === key && <span className="text-emerald-400 flex-shrink-0">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question type */}
              <div>
                <p className="text-xs text-slate-400 mb-3">Question style</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {QUESTION_TYPES.map((qt) => (
                    <button
                      key={qt.id}
                      type="button"
                      className={`rounded-[1.5rem] border p-4 text-left transition ${
                        questionType === qt.id
                          ? "border-[var(--primary-border)] bg-[var(--primary-bg)]"
                          : "border-white/8 bg-white/3 hover:border-white/15"
                      }`}
                      onClick={() => setQuestionType(qt.id)}
                    >
                      <span className="text-xl block mb-1.5">{qt.icon}</span>
                      <p className="text-sm font-semibold text-white">{qt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{qt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button className="ds-btn ds-btn-ghost ds-btn-pill flex-1" onClick={() => setStep("role")} type="button">← Back</button>
                <button className="ds-btn ds-btn-primary ds-btn-pill flex-1" onClick={() => setStep("ready")} type="button">Preview →</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Ready ── */}
          {step === "ready" && (
            <div className="anim anim-2 space-y-4">
              <p className="ds-label">Review & Start</p>

              {/* Summary card */}
              <div className={`rounded-[2rem] border bg-gradient-to-br ${selectedCompany.color} ${
                selectedCompany.id === "custom" ? "border-white/10" : "border-violet-300/15"
              } p-6`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                    {selectedCompany.logo}
                  </div>
                  <div>
                    <p className="text-xl font-black text-white">{finalCompany}</p>
                    <p className="text-sm text-slate-300">{finalRole}</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "Style", value: QUESTION_TYPES.find((q) => q.id === questionType)?.label ?? questionType },
                    { label: "Pressure", value: PRESSURE_CONFIG[pressure].label },
                    { label: "Language", value: "English" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-[1.2rem] bg-white/8 px-3 py-2.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pressure reminder */}
              {pressure === "pressure" && (
                <div className={`rounded-[1.5rem] border ${pressureCfg.border} ${pressureCfg.bg} px-4 py-3 text-sm`}>
                  <p className={`font-semibold ${pressureCfg.textColor}`}>🔥 Pressure Mode active</p>
                  <p className="text-slate-400 text-xs mt-1">
                    The AI will challenge every answer, ask follow-ups, and simulate real recruiter pressure. Good luck.
                  </p>
                </div>
              )}

              {scenarios.length === 0 && (
                <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  ⚠ Could not load scenarios yet. Make sure the backend is running.
                </div>
              )}

              <div className="flex gap-3">
                <button className="ds-btn ds-btn-ghost ds-btn-pill flex-1" onClick={() => setStep("settings")} type="button">← Back</button>
                <button
                  className="ds-btn ds-btn-primary ds-btn-pill flex-1 ds-btn-lg"
                  onClick={() => void startInterview()}
                  disabled={starting || scenarios.length === 0}
                  type="button"
                >
                  {starting ? <span className="ds-btn-spinner" /> : "🎤 Start Interview →"}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
