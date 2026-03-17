"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  BookOpen,
  PenLine,
  Flame,
  TrendingUp,
  GraduationCap,
  LogOut,
  BarChart2,
  Calendar,
  Mic,
  Clock,
  ClipboardList,
  MessageCircle,
  Briefcase,
  Globe,
  Repeat2,
  ChevronRight,
  Play,
  CircleCheck,
  Circle,
  Brain,
  Zap,
  RefreshCw,
  Star,
  Target,
} from "lucide-react";
import { readApiData } from "@/lib/api";

type Scenario = {
  id: number;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  system_prompt: string;
};

type User = {
  id: number;
  full_name: string;
  email: string;
  assessment_status: string;
  user_level?: string | null;
};

type Recommendation = {
  scenario_id: number;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  reason: string;
};

type PersonalizationData = {
  user_level: string | null;
  preferred_difficulty: string | null;
  focus_areas: string[];
  weak_score_type: string | null;
  recommendations: Recommendation[];
};

type ConversationLanguage = "English" | "Spanish" | "French" | "German";
type CorrectionMode =
  | "no_interruption"
  | "correct_every_answer"
  | "delayed"
  | "major_mistakes_only";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ─── Scenario metadata: Lucide icons + goals ─── */
import type { LucideIcon } from "lucide-react";

type ScenarioMeta = { Icon: LucideIcon; goal: string; color: string };

const SCENARIO_META: Record<string, ScenarioMeta> = {
  default:       { Icon: MessageCircle, goal: "Practice speaking naturally",             color: "from-cyan-500/20 to-blue-600/10" },
  "job interview":{ Icon: Mic,          goal: "Answer questions with confidence",         color: "from-violet-500/20 to-purple-600/10" },
  interview:     { Icon: Mic,           goal: "Answer questions with confidence",         color: "from-violet-500/20 to-purple-600/10" },
  restaurant:    { Icon: MessageCircle, goal: "Order food and make small talk",           color: "from-amber-500/20 to-orange-600/10" },
  travel:        { Icon: Globe,         goal: "Navigate travel situations in English",    color: "from-sky-500/20 to-cyan-600/10" },
  business:      { Icon: Briefcase,     goal: "Communicate professionally",               color: "from-emerald-500/20 to-teal-600/10" },
  medical:       { Icon: ClipboardList, goal: "Describe symptoms and understand advice",  color: "from-rose-500/20 to-pink-600/10" },
  shopping:      { Icon: Star,          goal: "Ask for items and negotiate prices",       color: "from-yellow-500/20 to-amber-600/10" },
  academic:      { Icon: GraduationCap, goal: "Discuss academic topics clearly",          color: "from-indigo-500/20 to-blue-600/10" },
  presentation:  { Icon: BarChart2,     goal: "Present your ideas persuasively",          color: "from-teal-500/20 to-emerald-600/10" },
  debate:        { Icon: MessageCircle, goal: "Argue your point with confidence",         color: "from-red-500/20 to-rose-600/10" },
};

function getScenarioMeta(title: string): ScenarioMeta {
  const lower = title.toLowerCase();
  for (const [key, val] of Object.entries(SCENARIO_META)) {
    if (key !== "default" && lower.includes(key)) return val;
  }
  return SCENARIO_META.default;
}

const DIFFICULTY_LABEL: Record<Scenario["difficulty"], string> = {
  Beginner: "Beginner",
  Intermediate: "Intermediate",
  Advanced: "Advanced",
};

const DIFFICULTY_STYLES: Record<Scenario["difficulty"], string> = {
  Beginner:     "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  Intermediate: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
  Advanced:     "border-orange-300/30 bg-orange-400/10 text-orange-200",
};

const LANGUAGES: ConversationLanguage[] = ["English", "Spanish", "French", "German"];

const TODAY_GOALS: { Icon: LucideIcon; text: string }[] = [
  { Icon: MessageCircle, text: "Complete 1 conversation" },
  { Icon: BookOpen,      text: "Practice 5 vocabulary words" },
  { Icon: Mic,           text: "Record a speaking exercise" },
];

const FOCUS_TIPS = [
  "Use longer, connected sentences instead of short answers.",
  "Add 'because' or 'however' to show your reasoning.",
  "Aim for 4–6 sentences per response.",
  "Avoid starting every sentence with 'I'.",
];

/* ─── Mode bar items ─── */
const MODES = [
  { href: "/interview",      Icon: Mic,      label: "Interview" },
  { href: "/modes/reallife", Icon: Globe,    label: "Real Life" },
  { href: "/modes/freeflow", Icon: MessageCircle, label: "Free Talk" },
  { href: "/modes",          Icon: Repeat2,  label: "All Modes" },
] as const;

/* ─── Nav shortcuts ─── */
const NAV_SHORTCUTS = [
  { href: "/daily",      Icon: Calendar,     label: "Daily" },
  { href: "/speaking",   Icon: Mic,          label: "Speaking" },
  { href: "/dashboard",  Icon: BarChart2,    label: "Progress" },
  { href: "/timeline",   Icon: Clock,        label: "History" },
  { href: "/assessment", Icon: ClipboardList,label: "Assess" },
] as const;

export default function PortalPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<ConversationLanguage>("English");
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("delayed");
  const [baseScenarioId, setBaseScenarioId] = useState<number>(1);
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<number | "custom" | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [activeTab, setActiveTab] = useState<"home" | "practice" | "custom">("home");
  const [streak] = useState(3);
  const [fluencyTrend] = useState("+4.2");
  const [personalization, setPersonalization] = useState<PersonalizationData | null>(null);
  const [goalsChecked, setGoalsChecked] = useState<boolean[]>([false, false, false]);
  const [focusTipIndex] = useState(() => Math.floor(Math.random() * FOCUS_TIPS.length));
  const scenariosRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 120) {
        setVisibleCount((p) => Math.min(p + 6, scenarios.length));
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [scenarios.length]);

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      setError("");
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, scenRes] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/me`, { headers }),
        fetch(`${API_BASE_URL}/scenarios`),
      ]);
      try {
        const [me, scen] = await Promise.all([
          readApiData<User>(meRes),
          readApiData<Scenario[] | { items: Scenario[] }>(scenRes),
        ]);
        if (me.assessment_status === "pending") { router.replace("/assessment"); return; }
        const items = Array.isArray(scen) ? scen : (scen as { items: Scenario[] }).items ?? [];
        setUser(me);
        setScenarios(items);
        if (items.length > 0) setBaseScenarioId((c) => c || items[0].id);
        fetch(`${API_BASE_URL}/personalization/recommendations?limit=4`, { headers })
          .then((r) => r.json())
          .then((d) => { if (d?.data) setPersonalization(d.data as PersonalizationData); })
          .catch(() => {});
      } catch {
        setError("Could not load your home. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router, token]);

  async function startConversation(scenarioId: number, opts?: { customTitle?: string; customPrompt?: string }) {
    if (!token) { router.push("/login"); return; }
    setStartingId(opts?.customPrompt ? "custom" : scenarioId);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/conversations/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scenario_id: scenarioId,
          language,
          custom_title: opts?.customTitle?.trim() || null,
          custom_prompt: opts?.customPrompt?.trim() || null,
          correction_mode: correctionMode,
        }),
      });
      const data = await readApiData<{ id: number }>(res);
      router.push(`/chat/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session. Try again.");
    } finally {
      setStartingId(null);
    }
  }

  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  const selectedScenario = scenarios.find((s) => s.id === baseScenarioId) ?? scenarios[0] ?? null;

  /* ─── Skeleton Loader ─── */
  if (loading) {
    return (
      <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-8">
        <div className="mx-auto max-w-4xl space-y-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/10" />
            <div className="h-4 w-32 rounded bg-white/10" />
          </div>
          <div className="h-40 rounded-[2rem] bg-white/5" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-[1.5rem] bg-white/5" />)}
          </div>
          <div className="h-16 rounded-[1.75rem] bg-white/8" />
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map((i) => <div key={i} className="h-24 rounded-[1.75rem] bg-white/5" />)}
          </div>
          <p className="text-center text-sm text-slate-600 pt-2">Loading your learning home…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-8">
      <section className="mx-auto max-w-4xl flex flex-col gap-6">

        {/* ─── Premium Integrated Header ─── */}
        <header className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-[2.5rem] border border-white/5 bg-slate-900/40 p-6 md:p-8 backdrop-blur-xl overflow-hidden shadow-2xl">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] opacity-10 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-violet-500/10 blur-[80px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_50%)]" />

          {/* Profile & Greeting */}
          <div className="relative flex items-center gap-5">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] text-slate-950 font-black text-2xl shadow-[0_0_20px_rgba(105,226,255,0.3)] ring-1 ring-white/20 select-none">
                {firstName[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-slate-950 bg-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-800 animate-pulse" />
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-bold mb-1 opacity-90">
                <Star fill="currentColor" size={10} />
                Welcome Back
              </p>
              <h1 className="display text-2xl md:text-3xl font-bold text-white tracking-tight">
                {firstName}, ready to grow?
              </h1>
              <p className="mt-1 text-sm text-slate-400 font-medium font-mono tracking-widest uppercase">
                {user?.user_level ? `Level ${user.user_level} Explorer` : "Complete a session to rank up"}
              </p>
            </div>
          </div>

          {/* Quick Actions (Progress/SignOut) */}
          <div className="relative flex items-center gap-2 rounded-[1.25rem] border border-white/10 bg-black/30 p-1.5 backdrop-blur-md">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition"
            >
              <BarChart2 size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              Progress
            </Link>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
              onClick={() => { window.localStorage.removeItem("token"); router.push("/login"); }}
              title="Sign out"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ─── Modes quick-access bar ─── */}
        <div className="grid grid-cols-4 gap-2">
          {MODES.map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-white/8 bg-white/3 py-4 text-center text-xs font-medium text-slate-400 hover:border-violet-300/25 hover:bg-violet-500/8 hover:text-white transition group"
            >
              <Icon size={18} className="text-slate-500 group-hover:text-violet-300 transition" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        {/* ─── Big CTA ─── */}
        <button
          className="group relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] p-6 text-left transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          onClick={() => { const s = scenarios[0]; if (s) void startConversation(s.id); }}
          disabled={scenarios.length === 0 || startingId !== null || !token}
          type="button"
        >
          <div className="pointer-events-none absolute inset-0 bg-white/0 transition group-hover:bg-white/10" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-950/50 uppercase tracking-wider">Recommended for you</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {startingId !== null ? "Starting…" : "Start Practicing"}
              </p>
              <p className="mt-0.5 text-sm text-slate-950/60">
                {selectedScenario ? `${selectedScenario.title} · ${language}` : "Choose a session below"}
              </p>
            </div>
            <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-950/10 text-slate-950 group-hover:scale-110 transition-transform">
              {startingId !== null
                ? <RefreshCw size={20} className="animate-spin" />
                : <Play size={20} fill="currentColor" />
              }
            </div>
          </div>
        </button>

        {/* ─── Tab Bar ─── */}
        <div className="flex gap-1.5 rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-1.5">
          {([
            { key: "home",     Icon: Home,     label: "Home" },
            { key: "practice", Icon: BookOpen,  label: "Practice" },
            { key: "custom",   Icon: PenLine,   label: "Custom" },
          ] as { key: "home"|"practice"|"custom"; Icon: LucideIcon; label: string }[]).map(({ key, Icon, label }) => (
            <button
              key={key}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[1.1rem] py-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                activeTab === key
                  ? "bg-white/10 border border-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => setActiveTab(key)}
              type="button"
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            HOME TAB
        ══════════════════════════════════════ */}
        {activeTab === "home" && (
          <div className="space-y-5">

            {/* ── Daily System entry card ── */}
            <Link
              href="/daily"
              className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-500/15 to-orange-600/8 p-5 transition hover:border-amber-300/40 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.12),transparent_60%)]" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500/20">
                  <Calendar size={22} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400 font-semibold">Daily System</p>
                  <p className="text-base font-bold text-white">Today&apos;s Plan</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {goalsChecked.filter(Boolean).length}/{TODAY_GOALS.length} tasks done · Earn XP &amp; level up
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5 rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-xs text-orange-200">
                  <Flame size={10} className="text-orange-400" />
                  {streak}d streak
                </div>
                <span className="flex items-center gap-1 text-xs text-amber-400 group-hover:text-amber-300 transition">
                  Open <ChevronRight size={12} />
                </span>
              </div>
            </Link>

            {/* ── Personalized Recommendations ── */}
            {personalization && personalization.recommendations.length > 0 && (
              <div className="glass-panel rounded-[2rem] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.28em] text-violet-300 font-semibold">
                      <Target size={11} className="text-violet-400" />
                      Recommended for You
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {personalization.preferred_difficulty ?? "All levels"}
                      {personalization.focus_areas.length > 0 && ` · Focus: ${personalization.focus_areas.slice(0, 2).join(", ")}`}
                    </p>
                  </div>
                  <button
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-300 transition"
                    onClick={() => setActiveTab("practice")}
                    type="button"
                  >
                    See all <ChevronRight size={12} />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {personalization.recommendations.map((rec) => {
                    const meta = getScenarioMeta(rec.title);
                    const isStarting = startingId === rec.scenario_id;
                    return (
                      <button
                        key={rec.scenario_id}
                        type="button"
                        disabled={startingId !== null}
                        onClick={() => void startConversation(rec.scenario_id)}
                        className="group flex w-full items-center gap-3 rounded-[1.5rem] border border-violet-300/10 bg-violet-500/6 px-4 py-3 text-left transition hover:border-violet-300/25 hover:bg-violet-500/12 disabled:opacity-50"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                          <meta.Icon size={18} className="text-violet-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{rec.title}</p>
                          <p className="text-[11px] text-violet-300/70 mt-0.5 truncate">{rec.reason}</p>
                        </div>
                        <span className="flex-shrink-0 text-slate-600 group-hover:text-violet-300 transition">
                          {isStarting ? <RefreshCw size={14} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Today's Goals ── */}
            <div className="glass-panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Target size={14} className="text-cyan-400" />
                  Today&apos;s Goals
                </h2>
                <span className="text-[11px] text-slate-500">{goalsChecked.filter(Boolean).length}/{TODAY_GOALS.length} done</span>
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)] transition-all duration-700"
                  style={{ width: `${(goalsChecked.filter(Boolean).length / TODAY_GOALS.length) * 100}%` }}
                />
              </div>
              <div className="space-y-2.5">
                {TODAY_GOALS.map(({ Icon, text }, i) => (
                  <button
                    key={text}
                    className={`flex w-full items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                      goalsChecked[i]
                        ? "border-emerald-300/20 bg-emerald-500/8 opacity-60"
                        : "border-white/8 bg-white/4 hover:border-white/15"
                    }`}
                    onClick={() => setGoalsChecked((p) => { const n = [...p]; n[i] = !n[i]; return n; })}
                    type="button"
                  >
                    <Icon size={15} className={goalsChecked[i] ? "text-emerald-400" : "text-slate-500"} />
                    <span className={`text-sm flex-1 ${goalsChecked[i] ? "line-through text-slate-500" : "text-slate-200"}`}>{text}</span>
                    {goalsChecked[i]
                      ? <CircleCheck size={16} className="text-emerald-400 flex-shrink-0" />
                      : <Circle size={16} className="text-slate-700 flex-shrink-0" />
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* ── Focus tip ── */}
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-400 font-medium">
                <Brain size={12} className="text-amber-400" />
                Focus Today
              </p>
              <p className="mt-3 text-lg font-semibold text-white leading-7">
                &ldquo;{FOCUS_TIPS[focusTipIndex]}&rdquo;
              </p>
            </div>

            {/* ── Quick stats ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: Flame,         label: "Streak",  val: `${streak}d`,               color: "text-orange-400" },
                { Icon: TrendingUp,    label: "Fluency", val: "Growing",                  color: "text-emerald-400" },
                { Icon: GraduationCap, label: "Level",   val: user?.user_level ?? "—",     color: "text-cyan-400" },
              ].map(({ Icon, label, val, color }) => (
                <div key={label} className="glass-panel rounded-[1.75rem] p-4 flex flex-col gap-2">
                  <Icon size={18} className={color} />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-white">{val}</p>
                </div>
              ))}
            </div>

            {/* ── Quick Start scenarios ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BookOpen size={14} className="text-cyan-400" />
                  Quick Start
                </h2>
                <button
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-300 transition"
                  onClick={() => setActiveTab("practice")}
                  type="button"
                >
                  See all <ChevronRight size={12} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {scenarios.slice(0, 4).map((s) => {
                  const meta = getScenarioMeta(s.title);
                  return (
                    <button
                      key={s.id}
                      className="group glass-panel relative overflow-hidden rounded-[1.75rem] p-5 text-left transition hover:-translate-y-0.5 disabled:opacity-50"
                      onClick={() => void startConversation(s.id)}
                      disabled={startingId !== null}
                      type="button"
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.color} opacity-60`} />
                      <div className="relative">
                        <meta.Icon size={22} className="text-white/70" />
                        <p className="mt-2 text-sm font-semibold text-white leading-5">{s.title}</p>
                        <p className="mt-1 text-xs text-slate-400 line-clamp-1">{meta.goal}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${DIFFICULTY_STYLES[s.difficulty]}`}>
                            {DIFFICULTY_LABEL[s.difficulty]}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-cyan-300 transition">
                            {startingId === s.id ? "Starting…" : <>Practice <ChevronRight size={10} /></>}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Nav shortcuts ── */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {NAV_SHORTCUTS.map(({ href, Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-[1.2rem] border border-white/8 bg-white/3 px-3 py-3 text-center text-xs font-medium text-slate-400 hover:border-cyan-300/25 hover:text-white transition group"
                >
                  <Icon size={15} className="text-slate-600 group-hover:text-cyan-300 transition" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            PRACTICE TAB
        ══════════════════════════════════════ */}
        {activeTab === "practice" && (
          <div className="space-y-6">
            {/* Settings row */}
            <div className="flex flex-col md:flex-row gap-5 mb-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  <Globe size={13} /> Language
                </span>
                <div className="flex flex-wrap gap-1 rounded-full border border-white/5 bg-slate-900/50 p-1">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${language === l ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                      onClick={() => setLanguage(l)}
                      type="button"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  <MessageCircle size={13} /> Feedback Style
                </span>
                <div className="flex flex-wrap gap-1 rounded-full border border-white/5 bg-slate-900/50 p-1">
                  {(
                    [
                      { value: "no_interruption",     label: "None" },
                      { value: "delayed",              label: "Delayed" },
                      { value: "major_mistakes_only",  label: "Big Only" },
                      { value: "correct_every_answer", label: "Instant" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${correctionMode === item.value ? "bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.3)]" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                      onClick={() => setCorrectionMode(item.value)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Netflix-style big cards */}
            <div ref={scenariosRef} className="grid gap-5 sm:grid-cols-2">
              {scenarios.slice(0, visibleCount).map((s, idx) => {
                const meta = getScenarioMeta(s.title);
                const isStarting = startingId === s.id;
                return (
                  <button
                    key={s.id}
                    className="group relative overflow-hidden rounded-[2rem] text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,0,0,0.5)] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                    onClick={() => void startConversation(s.id)}
                    disabled={startingId !== null}
                    type="button"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.color} opacity-70`} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,14,28,0.2)_0%,rgba(7,14,28,0.85)_100%)]" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(105,226,255,0.15),transparent_60%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-0 rounded-[2rem] border border-white/10 group-hover:border-cyan-300/20 transition" />

                    <div className="relative p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                          <meta.Icon size={22} className="text-white/80 drop-shadow-lg" />
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${DIFFICULTY_STYLES[s.difficulty]}`}>
                            {DIFFICULTY_LABEL[s.difficulty]}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                        </div>
                      </div>

                      <h3 className="mt-4 text-xl font-bold text-white leading-6">{s.title}</h3>
                      <p className="mt-1.5 text-sm text-slate-300 leading-5">
                        <span className="text-cyan-400/70 font-medium">Goal: </span>
                        {meta.goal}
                      </p>
                      <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-5">{s.description}</p>

                      <div className="mt-5 flex items-center gap-3">
                        <span className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition duration-200 ${
                          isStarting ? "bg-white/10 text-slate-300" : "bg-white text-slate-950 group-hover:bg-cyan-200"
                        }`}>
                          {isStarting
                            ? <><RefreshCw size={13} className="animate-spin" /> Starting…</>
                            : <><Play size={13} fill="currentColor" /> Start Practice</>
                          }
                        </span>
                        <span className="text-xs text-slate-500">{language}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {visibleCount < scenarios.length && (
              <div className="flex justify-center pt-2">
                <button
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm text-slate-400 hover:border-cyan-300/30 hover:text-white transition"
                  onClick={() => setVisibleCount((p) => Math.min(p + 6, scenarios.length))}
                  type="button"
                >
                  <Zap size={13} />
                  Load more
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            CUSTOM TAB
        ══════════════════════════════════════ */}
        {activeTab === "custom" && (
          <div className="glass-panel rounded-[2rem] p-6 md:p-8 space-y-5">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <PenLine size={11} />
                Your rules
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">Design your own session</h2>
              <p className="mt-1 text-sm text-slate-400">Pick a scenario base, then tell the AI exactly how to coach you.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block rounded-[1.4rem] border border-white/10 bg-slate-950/50 p-4">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Base Scenario</span>
                <select
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300/30 transition"
                  onChange={(e) => setBaseScenarioId(Number(e.target.value))}
                  value={baseScenarioId}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </label>
              <label className="block rounded-[1.4rem] border border-white/10 bg-slate-950/50 p-4">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Session Name (optional)</span>
                <input
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300/30 transition"
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Senior backend interview"
                  value={customTitle}
                />
              </label>
            </div>

            <label className="block rounded-[1.4rem] border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Instructions for the AI</span>
                <span className={`text-[11px] ${customPrompt.length > 4800 ? "text-rose-300" : "text-slate-600"}`}>
                  {customPrompt.length}/5000
                </span>
              </div>
              <textarea
                className="mt-3 min-h-[180px] w-full rounded-[1rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300/30 transition resize-none"
                maxLength={5000}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Act like a senior engineering manager. Ask one question at a time, push deep on weak answers. Focus on architecture and tradeoffs."
                value={customPrompt}
              />
            </label>

            <button
              className="flex w-full items-center justify-center gap-2 rounded-[1.35rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-4 font-bold text-slate-950 transition hover:scale-[1.01] disabled:opacity-50"
              disabled={!token || !baseScenarioId || !customPrompt.trim() || startingId === "custom"}
              onClick={() => void startConversation(baseScenarioId, { customTitle, customPrompt })}
              type="button"
            >
              {startingId === "custom"
                ? <><RefreshCw size={15} className="animate-spin" /> Starting…</>
                : <><Play size={15} fill="currentColor" /> Start Custom Session</>
              }
            </button>

            {error && (
              <p className="rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">❌ {error}</p>
            )}
          </div>
        )}

        {/* Global error */}
        {error && activeTab !== "custom" && (
          <p className="rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">❌ {error}</p>
        )}

        {!token && !loading && (
          <div className="glass-panel rounded-[2rem] p-8 text-center">
            <p className="text-slate-400">
              No session found.{" "}
              <Link className="text-cyan-300 hover:underline" href="/login">Log in to continue</Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
