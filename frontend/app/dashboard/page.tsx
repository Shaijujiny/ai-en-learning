"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

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

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [retention, setRetention] = useState<RetentionSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllTrends, setShowAllTrends] = useState(false);
  const [days, setDays] = useState<number>(14);
  const [scoreType, setScoreType] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [scenarioId, setScenarioId] = useState<number | "">("");
  const [mistakeType, setMistakeType] = useState<string>("");
  const [editingGoals, setEditingGoals] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<RetentionSummary["goals"] | null>(
    null,
  );

  useEffect(() => {
    const savedToken = window.localStorage.getItem("token") ?? "";
    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        query.set("days", String(days));
        if (scoreType) query.set("score_type", scoreType);
        if (language) query.set("language", language);
        if (scenarioId) query.set("scenario_id", String(scenarioId));
        if (mistakeType) query.set("mistake_type", mistakeType);

        const response = await fetch(`${API_BASE_URL}/analytics/dashboard?${query.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await readApiData<DashboardData>(response);
        setDashboard(data);
      } catch {
        setError(
          `Unable to reach the API at ${API_BASE_URL}. Check that the backend is running and CORS is configured for this frontend origin.`,
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [days, language, mistakeType, scoreType, scenarioId, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadRetention() {
      try {
        const response = await fetch(`${API_BASE_URL}/retention/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<RetentionSummary>(response);
        setRetention(data);
      } catch {
        // Keep dashboard usable even if retention summary fails.
      }
    }

    void loadRetention();
  }, [token]);

  async function saveGoals() {
    if (!token || !goalDraft) {
      return;
    }

    setSavingGoals(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/retention/goals`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(goalDraft),
      });
      const data = await readApiData<{ goals: RetentionSummary["goals"] }>(response);
      setRetention((current) =>
        current ? { ...current, goals: data.goals } : current,
      );
      setEditingGoals(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update goals.");
    } finally {
      setSavingGoals(false);
    }
  }

  const visibleHistory = showAllHistory
    ? dashboard?.conversation_history ?? []
    : (dashboard?.conversation_history ?? []).slice(0, 4);
  const visibleTrends = showAllTrends
    ? dashboard?.improvement_trends ?? []
    : (dashboard?.improvement_trends ?? []).slice(0, 2);

  return (
    <main className="app-shell grid-overlay px-5 py-6 text-slate-100 md:px-8 md:py-8">
      <section className="mx-auto max-w-6xl">
        <div className="glass-panel rounded-[2rem] p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Performance Dashboard
              </p>
              <h1 className="display mt-2 text-4xl font-semibold text-white">
                Track conversation progress
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                View score movement, skill quality, and past sessions in one
                analytics surface.
              </p>
            </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
              href="/timeline"
            >
              Coach timeline
            </Link>
            <Link
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
              href="/reports/weekly"
            >
              Weekly report
            </Link>
              <Link
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
                href="/portal"
              >
                Back to portal
              </Link>
            </div>
          </div>
        </div>

        {!token ? (
          <p className="mt-8 rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            No auth token found. Log in from the home page first.
          </p>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-400">Loading dashboard...</p>
        ) : null}

        {error ? (
          <p className="mt-8 rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {dashboard ? (
          <div className="mt-8 grid gap-6">
            <div className="glass-panel rounded-[2rem] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                  Smart filters
                </p>
                <span className="text-xs text-slate-400">
                  Filters update trends, history, and mistakes.
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <select
                  className="rounded-[1.25rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white"
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>

                <select
                  className="rounded-[1.25rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white"
                  value={scoreType}
                  onChange={(event) => setScoreType(event.target.value)}
                >
                  <option value="">All score types</option>
                  {(dashboard.improvement_trends ?? []).map((item) => (
                    <option key={item.score_type} value={item.score_type}>
                      {item.score_type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-[1.25rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="">All languages</option>
                  {Array.from(
                    new Set((dashboard.conversation_history ?? []).map((c) => c.language)),
                  ).map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-[1.25rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white"
                  value={scenarioId}
                  onChange={(event) =>
                    setScenarioId(event.target.value ? Number(event.target.value) : "")
                  }
                >
                  <option value="">All scenarios</option>
                  {Array.from(
                    new Map(
                      (dashboard.conversation_history ?? []).map((c) => [
                        c.scenario_id,
                        c.scenario_title,
                      ]),
                    ).entries(),
                  ).map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-[1.25rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white"
                  value={mistakeType}
                  onChange={(event) => setMistakeType(event.target.value)}
                >
                  <option value="">All mistake categories</option>
                  {Array.from(
                    new Set((dashboard.mistake_memory ?? []).map((m) => m.mistake_type)),
                  ).map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                  Performance Score
                </p>
                <div className="mt-6 flex items-end gap-4">
                  <span className="display text-7xl font-semibold text-white">
                    {dashboard.performance_score.toFixed(1)}
                  </span>
                  <span className="mb-3 text-sm text-slate-400">/100 overall</span>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-900/80">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)]"
                    style={{ width: `${Math.min(dashboard.performance_score, 100)}%` }}
                  />
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                  Learning Profile
                </p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-300">Current CEFR level</span>
                      <span className="text-lg font-semibold text-white">
                        {dashboard.current_level ?? "--"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-400">Confidence</span>
                      <span className="text-cyan-200">
                        {dashboard.level_confidence_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  {dashboard.level_history.length > 0 ? (
                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Level history
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {dashboard.level_history.map((item) => (
                          <div
                            key={`${item.created_at}-${item.source}`}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200"
                          >
                            {item.level} · {item.source}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {dashboard.skill_metrics.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No skill metrics yet. Run analyses to populate this dashboard.
                    </p>
                  ) : (
                    dashboard.skill_metrics.map((metric) => (
                      <div key={metric.skill_name}>
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-200">
                            {metric.skill_name.replaceAll("_", " ")}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {metric.metric_value.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-900/80">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#ff9f7a_0%,#69e2ff_100%)]"
                            style={{ width: `${Math.min(metric.metric_value, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {retention ? (
              <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
                <div className="glass-panel rounded-[2rem] p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                      Streaks and goals
                    </p>
                    <button
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
                      type="button"
                      onClick={() => {
                        setGoalDraft(retention.goals);
                        setEditingGoals(true);
                      }}
                    >
                      Edit goals
                    </button>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Daily streak
                      </p>
                      <p className="mt-3 text-5xl font-semibold text-white">
                        {retention.daily_streak}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {retention.active_today
                          ? "Active today"
                          : "Not active today yet"}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Weekly lesson days
                      </p>
                      <p className="mt-3 text-5xl font-semibold text-white">
                        {retention.progress.weekly_lesson_days}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Target {retention.goals.weekly_lesson_target}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-[2rem] p-6">
                  <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                    Weekly goals
                  </p>
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-200">
                        <span>Vocabulary items</span>
                        <span>
                          {retention.progress.weekly_vocabulary_items}/
                          {retention.goals.weekly_vocabulary_items}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/8">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)]"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.min(
                                (retention.progress.weekly_vocabulary_items /
                                  Math.max(retention.goals.weekly_vocabulary_items, 1)) *
                                  100,
                                100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-200">
                        <span>Fluency average</span>
                        <span>
                          {retention.progress.weekly_fluency_average.toFixed(1)}/
                          {retention.goals.weekly_fluency_target.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/8">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)]"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.min(
                                (retention.progress.weekly_fluency_average /
                                  Math.max(retention.goals.weekly_fluency_target, 1)) *
                                  100,
                                100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-200">
                        <span>Interview readiness</span>
                        <span>
                          {retention.progress.weekly_interview_readiness_average.toFixed(1)}/
                          {retention.goals.weekly_interview_readiness_target.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/8">
                        <div
                          className="h-2 rounded-full bg-[linear-gradient(90deg,#69e2ff_0%,#a7f3d0_100%)]"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.min(
                                (retention.progress.weekly_interview_readiness_average /
                                  Math.max(
                                    retention.goals.weekly_interview_readiness_target,
                                    1,
                                  )) *
                                  100,
                                100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {editingGoals && goalDraft ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
                <div className="glass-panel w-full max-w-xl rounded-[2rem] border border-white/10 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                        Edit goals
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Weekly targets
                      </h2>
                      <p className="mt-2 text-sm text-slate-300">
                        These guide streak and progress cards.
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
                      type="button"
                      onClick={() => setEditingGoals(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Weekly lesson days
                      </span>
                      <input
                        className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                        type="number"
                        min={1}
                        max={14}
                        value={goalDraft.weekly_lesson_target}
                        onChange={(event) =>
                          setGoalDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  weekly_lesson_target: Number(event.target.value),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Weekly vocabulary items
                      </span>
                      <input
                        className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                        type="number"
                        min={1}
                        max={200}
                        value={goalDraft.weekly_vocabulary_items}
                        onChange={(event) =>
                          setGoalDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  weekly_vocabulary_items: Number(event.target.value),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Weekly fluency target
                      </span>
                      <input
                        className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={goalDraft.weekly_fluency_target}
                        onChange={(event) =>
                          setGoalDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  weekly_fluency_target: Number(event.target.value),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Weekly interview readiness target
                      </span>
                      <input
                        className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={goalDraft.weekly_interview_readiness_target}
                        onChange={(event) =>
                          setGoalDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  weekly_interview_readiness_target: Number(
                                    event.target.value,
                                  ),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      className="rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                      type="button"
                      disabled={savingGoals}
                      onClick={() => void saveGoals()}
                    >
                      {savingGoals ? "Saving..." : "Save goals"}
                    </button>
                    <button
                      className="rounded-[1.2rem] border border-white/10 bg-white/6 px-5 py-3 text-sm font-medium text-white"
                      type="button"
                      onClick={() => setEditingGoals(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                  Improvement Trends
                </p>
                <div className="mt-4 space-y-5">
                  {dashboard.improvement_trends.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No trend data yet. Run fluency or vocabulary analysis to
                      generate trends.
                    </p>
                  ) : (
                    visibleTrends.map((trend) => (
                      <div
                        key={trend.score_type}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-white">
                            {trend.score_type}
                          </span>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            {trend.points.length} points
                          </span>
                        </div>
                        <div className="flex items-end gap-2">
                          {trend.points.map((point) => (
                            <div
                              key={`${trend.score_type}-${point.label}`}
                              className="flex flex-1 flex-col items-center gap-2"
                            >
                              <div className="flex h-28 w-full items-end">
                                <div
                                  className="w-full rounded-t-xl bg-[linear-gradient(180deg,#69e2ff_0%,#ff9f7a_100%)]"
                                  style={{ height: `${Math.max(point.value, 6)}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {point.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {dashboard.improvement_trends.length > 2 ? (
                  <button
                    className="mt-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
                    onClick={() => setShowAllTrends((current) => !current)}
                    type="button"
                  >
                    {showAllTrends
                      ? "Show fewer trends"
                      : `View ${dashboard.improvement_trends.length - visibleTrends.length} more trends`}
                  </button>
                ) : null}
              </div>
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                  Personalized Lessons
                </p>
                <div className="mt-4 space-y-4">
                  {dashboard.personalized_lessons.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No lessons generated yet. Complete assessment or run analyses first.
                    </p>
                  ) : (
                    dashboard.personalized_lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-white">
                            {lesson.title}
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">
                            {lesson.lesson_type.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                          {lesson.instructions}
                        </p>
                        {lesson.recommended_scenario ? (
                          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                            Scenario: {lesson.recommended_scenario}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                  Mistake Memory
                </p>
                <div className="mt-4 space-y-4">
                  {dashboard.mistake_memory.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No repeated mistakes tracked yet.
                    </p>
                  ) : (
                    dashboard.mistake_memory.map((item) => (
                      <div
                        key={`${item.mistake_type}-${item.mistake_key}`}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-white">
                            {item.mistake_type.replaceAll("_", " ")}
                          </span>
                          <span className="text-xs text-slate-400">
                            {item.occurrence_count} times
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">
                          {item.hint ?? item.mistake_key}
                        </p>
                        {item.correction ? (
                          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-cyan-300">
                            Correction: {item.correction}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-panel flex max-h-[760px] flex-col rounded-[2rem] p-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                    Conversation History
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                    {dashboard.conversation_history.length} total
                  </span>
                </div>
                <div className="scrollbar-subtle mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
                  {dashboard.conversation_history.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No conversation history available yet.
                    </p>
                  ) : (
                    visibleHistory.map((item) => (
                      <div
                        key={item.conversation_id}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 transition hover:border-cyan-300/40 hover:bg-slate-900/70"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <h2 className="text-lg font-medium text-white">
                            {item.scenario_title}
                          </h2>
                          <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {item.latest_message ?? "No messages recorded yet."}
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-4 text-xs text-slate-400">
                          <span>{item.message_count} messages</span>
                          <span>{new Date(item.started_at).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
                            href={`/chat/${item.conversation_id}`}
                          >
                            Open chat
                          </Link>
                          <Link
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
                            href={`/replay/${item.conversation_id}`}
                          >
                            Replay
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {dashboard.conversation_history.length > 4 ? (
                  <button
                    className="mt-5 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
                    onClick={() => setShowAllHistory((current) => !current)}
                    type="button"
                  >
                    {showAllHistory
                      ? "Show fewer conversations"
                      : `View ${dashboard.conversation_history.length - visibleHistory.length} more conversations`}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
