"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readApiData } from "@/lib/api";

/* ─── Types (preserved from original) ─── */
type SkillMetric = {
  skill_name: string;
  metric_value: number;
  sample_count: number;
  updated_at: string;
};

type LevelHistoryItem = {
  level: string;
  confidence_score: number;
  source: string;
  created_at: string;
};

type PersonalizedLesson = {
  id: number;
  lesson_type: string;
  target_skill: string;
  title: string;
  instructions: string;
  status: string;
  recommended_scenario: string | null;
  created_at: string;
};

type MistakeMemoryItem = {
  mistake_type: string;
  mistake_key: string;
  hint: string | null;
  correction: string | null;
  occurrence_count: number;
  last_seen_at: string;
};

type TrendPoint = {
  label: string;
  value: number;
};

type ImprovementTrend = {
  score_type: string;
  points: TrendPoint[];
};

type ConversationHistoryItem = {
  conversation_id: number;
  scenario_title: string;
  status: string;
  scenario_id: number;
  language: string;
  message_count: number;
  started_at: string;
  latest_message: string | null;
};

type DashboardData = {
  performance_score: number;
  current_level: string | null;
  level_confidence_score: number;
  level_history: LevelHistoryItem[];
  skill_metrics: SkillMetric[];
  improvement_trends: ImprovementTrend[];
  personalized_lessons: PersonalizedLesson[];
  mistake_memory: MistakeMemoryItem[];
  conversation_history: ConversationHistoryItem[];
};

type RetentionSummary = {
  today: string;
  daily_streak: number;
  active_today: boolean;
  weekly_range_start: string;
  weekly_range_end: string;
  goals: {
    weekly_lesson_target: number;
    weekly_vocabulary_items: number;
    weekly_fluency_target: number;
    weekly_interview_readiness_target: number;
  };
  progress: {
    weekly_lesson_days: number;
    weekly_vocabulary_items: number;
    weekly_fluency_average: number;
    weekly_interview_readiness_average: number;
  };
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ─── Skill display config ─── */
const SKILL_META: Record<string, { icon: string; label: string; goodAbove: number }> = {
  fluency: { icon: "🌊", label: "Fluency", goodAbove: 70 },
  grammar_accuracy: { icon: "📐", label: "Grammar", goodAbove: 72 },
  sentence_complexity: { icon: "🧩", label: "Complexity", goodAbove: 60 },
  word_diversity: { icon: "📚", label: "Vocabulary", goodAbove: 65 },
  advanced_vocabulary: { icon: "🔤", label: "Adv. Words", goodAbove: 55 },
  answer_quality_overall: { icon: "⭐", label: "Answer Quality", goodAbove: 68 },
  confidence: { icon: "💪", label: "Confidence", goodAbove: 65 },
};

function skillIcon(key: string) { return SKILL_META[key]?.icon ?? "📊"; }
function skillLabel(key: string) {
  return SKILL_META[key]?.label ?? key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function isGood(key: string, val: number) { return val >= (SKILL_META[key]?.goodAbove ?? 65); }
function scoreColor(val: number) {
  if (val >= 72) return "text-emerald-300";
  if (val >= 52) return "text-amber-300";
  return "text-rose-300";
}
function barColor(val: number) {
  if (val >= 72) return "bg-emerald-400";
  if (val >= 52) return "bg-amber-400";
  return "bg-rose-400";
}

/* ─── SVG Sparkline chart ─── */
function SparklineChart({ points, color = "#69e2ff", height = 72 }: {
  points: TrendPoint[];
  color?: string;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-slate-600">
        Not enough data yet
      </div>
    );
  }

  const w = 280;
  const h = height;
  const pad = 6;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const toX = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const toY = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${h} L ${toX(0).toFixed(1)} ${h} Z`;

  const trend = vals[vals.length - 1] - vals[0];
  const trendIcon = trend > 2 ? "↑" : trend < -2 ? "↓" : "→";
  const trendColor = trend > 2 ? "#34d399" : trend < -2 ? "#f87171" : "#94a3b8";

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last dot */}
        <circle cx={toX(points.length - 1)} cy={toY(vals[vals.length - 1])} r="3.5" fill={color} />
      </svg>
      {/* Trend badge */}
      <span className="absolute top-0 right-0 text-xs font-bold" style={{ color: trendColor }}>{trendIcon} {Math.abs(trend).toFixed(1)}</span>
    </div>
  );
}

/* ─── Insights engine: generate human-readable cards from data ─── */
function generateInsights(data: DashboardData): { icon: string; text: string; type: "good" | "warn" | "info" }[] {
  const insights: { icon: string; text: string; type: "good" | "warn" | "info" }[] = [];
  const metrics = Object.fromEntries(data.skill_metrics.map((m) => [m.skill_name, m.metric_value]));

  // Fluency
  const fluency = metrics["fluency"];
  if (fluency !== undefined) {
    if (fluency < 50) insights.push({ icon: "🌊", text: "Your fluency is below average. Try writing longer, connected answers.", type: "warn" });
    else if (fluency >= 80) insights.push({ icon: "🌊", text: "Strong fluency! Your responses flow naturally.", type: "good" });
  }

  // Grammar
  const grammar = metrics["grammar_accuracy"];
  if (grammar !== undefined && grammar < 60) {
    insights.push({ icon: "📐", text: "Grammar accuracy needs work. Focus on subject-verb agreement and tense consistency.", type: "warn" });
  }

  // Vocabulary
  const vocab = metrics["word_diversity"];
  const totalConvs = data.conversation_history.length;
  if (vocab !== undefined && vocab < 55) {
    insights.push({ icon: "📚", text: `You tend to repeat common words. Try replacing overused verbs with stronger alternatives.`, type: "warn" });
  }

  // Sentence complexity
  const complexity = metrics["sentence_complexity"];
  if (complexity !== undefined && complexity < 50) {
    insights.push({ icon: "🧩", text: "Your sentences are too short. Add one 'because', 'although', or 'however' per response.", type: "warn" });
  } else if (complexity !== undefined && complexity >= 75) {
    insights.push({ icon: "🧩", text: "You use complex sentence structures well. Keep it up!", type: "good" });
  }

  // Mistake patterns
  const topMistake = [...data.mistake_memory].sort((a, b) => b.occurrence_count - a.occurrence_count)[0];
  if (topMistake && topMistake.occurrence_count >= 3) {
    insights.push({ icon: "🔁", text: `You&apos;ve repeated the same mistake ${topMistake.occurrence_count} times. Review the correction below.`, type: "warn" });
  }

  // Overall performance
  if (data.performance_score >= 80) {
    insights.push({ icon: "🎯", text: "Excellent overall score! You're progressing quickly towards fluency.", type: "good" });
  } else if (data.performance_score < 45) {
    insights.push({ icon: "💡", text: "Practice more conversations to improve your overall score.", type: "info" });
  }

  // Trend direction
  for (const trend of data.improvement_trends) {
    if (trend.points.length >= 3) {
      const recent = trend.points.slice(-3).map((p) => p.value);
      const rising = recent.every((v, i) => i === 0 || v >= recent[i - 1]);
      const falling = recent.every((v, i) => i === 0 || v <= recent[i - 1]);
      if (rising) insights.push({ icon: "📈", text: `${skillLabel(trend.score_type)} is trending up over the last 3 sessions.`, type: "good" });
      if (falling) insights.push({ icon: "📉", text: `${skillLabel(trend.score_type)} has been falling. Review recent sessions.`, type: "warn" });
    }
  }

  if (totalConvs === 0) {
    insights.push({ icon: "🚀", text: "No conversations yet. Start your first practice session to see insights.", type: "info" });
  }

  return insights.slice(0, 4);
}

/* ─── Mistake memory card ─── */
function MistakeCard({ item, rank }: { item: MistakeMemoryItem; rank: number }) {
  const isBad = item.occurrence_count >= 5;
  return (
    <div
      className={`rounded-[1.6rem] border p-5 ${
        rank === 0
          ? "border-rose-300/25 bg-rose-500/8"
          : "border-white/8 bg-white/4"
      }`}
      style={{ animation: `fadeUp 0.4s ease ${rank * 0.06}s both` }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {rank === 0 && <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400">🔴 Top mistake</span>}
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.mistake_type.replaceAll("_", " ")}</span>
        </div>
        <div className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${
          isBad ? "border-rose-300/25 bg-rose-500/15 text-rose-300" : "border-amber-300/20 bg-amber-500/10 text-amber-300"
        }`}>
          🔁 {item.occurrence_count}×
        </div>
      </div>

      {/* Error → Correction */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-[1rem] border border-rose-300/15 bg-rose-500/8 px-3 py-2.5">
          <span className="flex-shrink-0 text-sm text-rose-400 font-bold mt-0.5">❌</span>
          <p className="text-sm text-rose-100 leading-5 font-medium">{item.hint ?? item.mistake_key}</p>
        </div>
        {item.correction && (
          <div className="flex items-start gap-2 rounded-[1rem] border border-emerald-300/15 bg-emerald-500/8 px-3 py-2.5">
            <span className="flex-shrink-0 text-sm text-emerald-400 font-bold mt-0.5">✅</span>
            <p className="text-sm text-emerald-100 leading-5">&ldquo;{item.correction}&rdquo;</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-600">
        Last seen {new Date(item.last_seen_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </p>
    </div>
  );
}

/* ─── Trend chart card ─── */
const CHART_COLORS: Record<string, string> = {
  fluency: "#69e2ff",
  grammar_accuracy: "#a78bfa",
  vocabulary: "#34d399",
  sentence_complexity: "#fbbf24",
  answer_quality_overall: "#f472b6",
  word_diversity: "#60a5fa",
};

function trendColor(key: string) {
  return CHART_COLORS[key] ?? "#69e2ff";
}

/* ─── Loading skeleton ─── */
function Skeleton() {
  return (
    <div className="mt-6 grid gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 rounded-[2rem] bg-white/5 border border-white/8" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [retention, setRetention] = useState<RetentionSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(14);
  const [activeTab, setActiveTab] = useState<"insights" | "charts" | "mistakes" | "history">("insights");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<RetentionSummary["goals"] | null>(null);
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ days: String(days) });
        const [dbRes, retRes] = await Promise.all([
          fetch(`${API_BASE_URL}/analytics/dashboard?${query}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/retention/summary`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [dbData, retData] = await Promise.all([
          readApiData<DashboardData>(dbRes),
          readApiData<RetentionSummary>(retRes),
        ]);
        setDashboard(dbData);
        setRetention(retData);
      } catch {
        setError(`Unable to reach the API at ${API_BASE_URL}. Check that the backend is running.`);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [days, token]);

  async function saveGoals() {
    if (!token || !goalDraft) return;
    setSavingGoals(true);
    try {
      const res = await fetch(`${API_BASE_URL}/retention/goals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(goalDraft),
      });
      const data = await readApiData<{ goals: RetentionSummary["goals"] }>(res);
      setRetention((r) => r ? { ...r, goals: data.goals } : r);
      setEditingGoals(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update goals.");
    } finally {
      setSavingGoals(false);
    }
  }

  const insights = useMemo(() => dashboard ? generateInsights(dashboard) : [], [dashboard]);
  const sortedMistakes = useMemo(
    () => [...(dashboard?.mistake_memory ?? [])].sort((a, b) => b.occurrence_count - a.occurrence_count),
    [dashboard]
  );
  const visibleHistory = showAllHistory
    ? (dashboard?.conversation_history ?? [])
    : (dashboard?.conversation_history ?? []).slice(0, 4);

  /* ─── KPIs derived from data ─── */
  const kpis = useMemo(() => {
    if (!dashboard) return null;
    const metrics = Object.fromEntries(dashboard.skill_metrics.map((m) => [m.skill_name, m.metric_value]));
    const fluencyTrend = dashboard.improvement_trends.find((t) => t.score_type === "fluency");
    const recentFluency = fluencyTrend?.points?.slice(-1)[0]?.value ?? metrics["fluency"] ?? 0;
    // Estimate WPM from fluency (proxy — no direct WPM in API)
    const estimatedWpm = Math.round(80 + (recentFluency / 100) * 60);
    // Unique-word ratio proxy for repeated words
    const repetition = Math.round((1 - (metrics["word_diversity"] ?? 60) / 100) * 30);
    return { estimatedWpm, repetition, fluency: recentFluency, metrics };
  }, [dashboard]);

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes countUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .anim { animation: fadeUp 0.45s ease both; }
        .anim-1 { animation-delay:0.06s }
        .anim-2 { animation-delay:0.12s }
        .anim-3 { animation-delay:0.18s }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-6 md:py-8">
        <div className="mx-auto max-w-5xl flex flex-col gap-6">

          {/* ─── Page header ─── */}
          <div className="anim flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Analytics</p>
              <h1 className="text-2xl font-bold text-white mt-1">Your Progress</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 outline-none"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <Link href="/portal" className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300 hover:border-cyan-300/30 hover:text-white transition">
                ← Portal
              </Link>
              <Link href="/timeline" className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300 hover:border-cyan-300/30 hover:text-white transition">
                Timeline
              </Link>
            </div>
          </div>

          {/* Error / no-token */}
          {!token && (
            <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              No auth token. <Link href="/login" className="underline">Log in</Link> first.
            </div>
          )}
          {error && (
            <div className="rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200 flex gap-3">
              <span>❌ {error}</span>
              <button className="ml-auto text-xs text-slate-500 hover:text-white" onClick={() => setError("")} type="button">Dismiss</button>
            </div>
          )}

          {loading && <Skeleton />}

          {dashboard && kpis && (
            <>
              {/* ─── KPI row ─── */}
              <div className="anim grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: "🏆", label: "Overall Score", value: dashboard.performance_score.toFixed(0), unit: "/100", color: scoreColor(dashboard.performance_score) },
                  { icon: "🎓", label: "CEFR Level", value: dashboard.current_level ?? "--", unit: "", color: "text-cyan-300" },
                  { icon: "🔥", label: "Streak", value: String(retention?.daily_streak ?? 0), unit: " days", color: "text-amber-300" },
                  { icon: "💬", label: "Conversations", value: String(dashboard.conversation_history.length), unit: " total", color: "text-violet-300" },
                ].map(({ icon, label, value, unit, color }, i) => (
                  <div key={label} className={`rounded-[1.75rem] border border-white/8 bg-white/4 p-4 anim anim-${i % 4}`}>
                    <p className="text-xl mb-1">{icon}</p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className={`text-2xl font-black mt-1 ${color}`}>{value}<span className="text-sm text-slate-500">{unit}</span></p>
                  </div>
                ))}
              </div>

              {/* ─── Plain-language insight cards ─── */}
              {insights.length > 0 && (
                <div className="anim anim-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 mb-3">📊 What this means for you</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {insights.map((ins, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-[1.5rem] border px-4 py-4 ${
                        ins.type === "good" ? "border-emerald-300/20 bg-emerald-500/8" :
                        ins.type === "warn" ? "border-amber-300/20 bg-amber-500/8" :
                        "border-white/10 bg-white/4"
                      }`} style={{ animation: `fadeUp 0.4s ease ${i * 0.07}s both` }}>
                        <span className="text-xl flex-shrink-0 mt-0.5">{ins.icon}</span>
                        <p className={`text-sm leading-6 ${
                          ins.type === "good" ? "text-emerald-100" : ins.type === "warn" ? "text-amber-100" : "text-slate-300"
                        }`} dangerouslySetInnerHTML={{ __html: ins.text }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Tab nav ─── */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: "insights", label: "📊 Skills" },
                  { key: "charts", label: "📈 Trends" },
                  { key: "mistakes", label: "🔁 Mistakes" },
                  { key: "history", label: "💬 History" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      activeTab === key
                        ? "bg-white text-slate-950"
                        : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                    }`}
                    onClick={() => setActiveTab(key)}
                    type="button"
                  >
                    {label}
                    {key === "mistakes" && sortedMistakes.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-rose-500/30 px-1.5 text-rose-200 text-[9px]">{sortedMistakes.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ════════════════════════
                  TAB: SKILLS
              ════════════════════════ */}
              {activeTab === "insights" && (
                <div className="grid gap-4 sm:grid-cols-2 anim">
                  {dashboard.skill_metrics.length === 0 ? (
                    <div className="col-span-2 rounded-[1.75rem] border border-dashed border-white/10 bg-white/3 py-10 text-center text-sm text-slate-500">
                      No skill data yet. Complete some conversations to generate metrics.
                    </div>
                  ) : (
                    dashboard.skill_metrics.map((m, i) => {
                      const good = isGood(m.skill_name, m.metric_value);
                      return (
                        <div
                          key={m.skill_name}
                          className={`rounded-[1.75rem] border p-5 ${good ? "border-emerald-300/15 bg-emerald-500/5" : "border-white/8 bg-white/4"}`}
                          style={{ animation: `fadeUp 0.4s ease ${i * 0.05}s both` }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{skillIcon(m.skill_name)}</span>
                              <span className="text-sm font-semibold text-white">{skillLabel(m.skill_name)}</span>
                            </div>
                            <span className={`text-xl font-black ${scoreColor(m.metric_value)}`}>
                              {Math.round(m.metric_value)}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${barColor(m.metric_value)}`}
                              style={{ width: `${Math.max(3, Math.min(m.metric_value, 100))}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                            <span>{good ? "✓ Good" : "→ Needs work"}</span>
                            <span>{m.sample_count} samples</span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Streak + weekly goals inline */}
                  {retention && (
                    <div className="col-span-2 grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Streak", value: String(retention.daily_streak), unit: "days", icon: "🔥", bar: retention.daily_streak / 30, color: "bg-amber-400" },
                        {
                          label: "Weekly Fluency",
                          value: retention.progress.weekly_fluency_average.toFixed(0),
                          unit: `/${retention.goals.weekly_fluency_target.toFixed(0)} target`,
                          icon: "🌊",
                          bar: Math.min(retention.progress.weekly_fluency_average / Math.max(retention.goals.weekly_fluency_target, 1), 1),
                          color: "bg-cyan-400",
                        },
                        {
                          label: "Lesson Days",
                          value: String(retention.progress.weekly_lesson_days),
                          unit: `/${retention.goals.weekly_lesson_target} target`,
                          icon: "📅",
                          bar: Math.min(retention.progress.weekly_lesson_days / Math.max(retention.goals.weekly_lesson_target, 1), 1),
                          color: "bg-violet-400",
                        },
                      ].map(({ label, value, unit, icon, bar, color }) => (
                        <div key={label} className="rounded-[1.6rem] border border-white/8 bg-white/4 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">{icon}</span>
                            <span className="text-xs text-slate-400">{label}</span>
                          </div>
                          <p className="text-2xl font-black text-white">{value}<span className="text-xs text-slate-500 ml-1">{unit}</span></p>
                          <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, Math.min(bar * 100, 100))}%` }} />
                          </div>
                        </div>
                      ))}
                      <button
                        className="text-[11px] text-slate-500 hover:text-white transition text-left pl-1 col-span-3"
                        onClick={() => { setGoalDraft(retention.goals); setEditingGoals(true); }}
                        type="button"
                      >
                        ✏️ Edit weekly goals
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════
                  TAB: CHARTS
              ════════════════════════ */}
              {activeTab === "charts" && (
                <div className="grid gap-5 anim">
                  {dashboard.improvement_trends.length === 0 ? (
                    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/3 py-10 text-center text-sm text-slate-500">
                      No trend data yet. Run fluency or vocabulary analyses to see graphs here.
                    </div>
                  ) : (
                    dashboard.improvement_trends.map((trend, i) => {
                      const pts = trend.points;
                      const lastVal = pts[pts.length - 1]?.value ?? 0;
                      const firstVal = pts[0]?.value ?? 0;
                      const delta = lastVal - firstVal;
                      return (
                        <div
                          key={trend.score_type}
                          className="glass-panel rounded-[2rem] p-5"
                          style={{ animation: `fadeUp 0.4s ease ${i * 0.07}s both` }}
                        >
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{skillIcon(trend.score_type)}</span>
                              <div>
                                <p className="text-sm font-semibold text-white">{skillLabel(trend.score_type)}</p>
                                <p className="text-[11px] text-slate-500">{pts.length} data points · last {days} days</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-bold ${scoreColor(lastVal)}`}>{lastVal.toFixed(0)}/100</span>
                              <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                                delta > 0 ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-300" :
                                delta < 0 ? "border-rose-300/25 bg-rose-500/10 text-rose-300" :
                                "border-white/10 bg-white/5 text-slate-400"
                              }`}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}</span>
                            </div>
                          </div>

                          <SparklineChart points={pts} color={trendColor(trend.score_type)} />

                          {/* X-axis labels */}
                          {pts.length > 1 && (
                            <div className="flex justify-between mt-1">
                              {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p, j) => (
                                <span key={j} className="text-[10px] text-slate-600">{p?.label ?? ""}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Personalized lessons */}
                  {dashboard.personalized_lessons.length > 0 && (
                    <div className="glass-panel rounded-[2rem] p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-cyan-300 mb-4">🎯 Personalized lessons for you</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {dashboard.personalized_lessons.slice(0, 4).map((lesson) => (
                          <div key={lesson.id} className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-semibold text-white">{lesson.title}</span>
                              <span className="text-[10px] uppercase tracking-wider text-cyan-300">{lesson.lesson_type.replaceAll("_", " ")}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-5">{lesson.instructions}</p>
                            {lesson.recommended_scenario && (
                              <p className="mt-2 text-[10px] text-slate-600">Scenario: {lesson.recommended_scenario}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════
                  TAB: MISTAKES
              ════════════════════════ */}
              {activeTab === "mistakes" && (
                <div className="anim">
                  {sortedMistakes.length === 0 ? (
                    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/3 py-12 text-center">
                      <p className="text-3xl mb-3">🌟</p>
                      <p className="text-sm font-medium text-white">No mistakes recorded yet</p>
                      <p className="mt-1 text-xs text-slate-500">Mistakes are tracked automatically from your conversations</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                          🔁 {sortedMistakes.length} pattern{sortedMistakes.length !== 1 ? "s" : ""} tracked
                        </p>
                        <span className="text-[11px] text-slate-600">Sorted by frequency</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {sortedMistakes.map((item, i) => (
                          <MistakeCard key={`${item.mistake_type}-${item.mistake_key}`} item={item} rank={i} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════
                  TAB: HISTORY
              ════════════════════════ */}
              {activeTab === "history" && (
                <div className="anim space-y-4">
                  {dashboard.conversation_history.length === 0 ? (
                    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/3 py-12 text-center">
                      <p className="text-sm text-slate-500">No conversations yet. Start practicing!</p>
                    </div>
                  ) : (
                    <>
                      {visibleHistory.map((item, i) => (
                        <div
                          key={item.conversation_id}
                          className="glass-panel rounded-[1.75rem] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25"
                          style={{ animation: `fadeUp 0.35s ease ${i * 0.05}s both` }}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-white truncate">{item.scenario_title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{item.language} · {item.message_count} messages · {new Date(item.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                            </div>
                            <span className={`flex-shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider ${
                              item.status === "active" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400"
                            }`}>{item.status}</span>
                          </div>
                          {item.latest_message && (
                            <p className="mt-3 text-sm text-slate-400 leading-6 line-clamp-2">{item.latest_message}</p>
                          )}
                          <div className="mt-4 flex gap-2">
                            <Link href={`/chat/${item.conversation_id}`}
                              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-cyan-300/25 hover:text-white transition">
                              Open chat
                            </Link>
                            <Link href={`/replay/${item.conversation_id}`}
                              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-cyan-300/25 hover:text-white transition">
                              Replay
                            </Link>
                          </div>
                        </div>
                      ))}
                      {dashboard.conversation_history.length > 4 && (
                        <button
                          className="w-full rounded-full border border-white/10 bg-white/5 py-3 text-xs text-slate-400 hover:text-white transition"
                          onClick={() => setShowAllHistory((p) => !p)}
                          type="button"
                        >
                          {showAllHistory ? "Show fewer" : `View ${dashboard.conversation_history.length - 4} more conversations`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── Goal edit modal ─── */}
          {editingGoals && goalDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4" onClick={() => setEditingGoals(false)}>
              <div className="glass-panel w-full max-w-lg rounded-[2rem] p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Edit Weekly Goals</h2>
                  <button className="text-xs text-slate-500 hover:text-white" onClick={() => setEditingGoals(false)} type="button">✕</button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { key: "weekly_lesson_target" as const, label: "Lesson days", min: 1, max: 14 },
                    { key: "weekly_vocabulary_items" as const, label: "Vocabulary items", min: 1, max: 200 },
                    { key: "weekly_fluency_target" as const, label: "Fluency target", min: 0, max: 100 },
                    { key: "weekly_interview_readiness_target" as const, label: "Interview readiness target", min: 0, max: 100 },
                  ].map(({ key, label, min, max }) => (
                    <label key={key} className="space-y-1.5">
                      <span className="text-xs text-slate-400">{label}</span>
                      <input
                        type="number" min={min} max={max}
                        value={goalDraft[key]}
                        onChange={(e) => setGoalDraft((g) => g ? { ...g, [key]: Number(e.target.value) } : g)}
                        className="w-full rounded-[1.2rem] border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-300/25"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    className="flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff,#a7f3d0)] py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                    disabled={savingGoals}
                    onClick={() => void saveGoals()}
                    type="button"
                  >
                    {savingGoals ? "Saving…" : "Save goals"}
                  </button>
                  <button className="flex-1 rounded-[1.2rem] border border-white/10 bg-white/5 py-3 text-sm text-white" onClick={() => setEditingGoals(false)} type="button">Cancel</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
