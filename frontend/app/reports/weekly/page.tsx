"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

type SkillSummary = { skill_name: string | null; metric_value: number };

type WeeklyMistake = {
  mistake_type: string;
  mistake_key: string;
  hint: string | null;
  correction: string | null;
  occurrence_count: number;
  last_seen_at: string | null;
};

type TrendPoint = { label: string; value: number };
type WeeklyTrend = { score_type: string; points: TrendPoint[] };

type WeeklyReport = {
  range_start: string;
  range_end: string;
  strongest_skill: SkillSummary;
  weakest_skill: SkillSummary;
  repeated_mistakes: WeeklyMistake[];
  weekly_trend: WeeklyTrend[];
  next_week_goals: string[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function labelSkill(skill: string | null) {
  return skill ? skill.replaceAll("_", " ") : "Not available";
}

export default function WeeklyReportPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/reports/weekly`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<WeeklyReport>(response);
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="glass-panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
            Weekly Progress Report
          </p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="display text-4xl font-semibold text-white md:text-6xl">
                {report
                  ? `${report.range_start} to ${report.range_end}`
                  : "Last 7 days"}
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Strongest skill, weakest skill, repeated mistakes, trends, and
                next-week goals.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                href="/dashboard"
              >
                Back to dashboard
              </Link>
              <Link
                className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                href="/portal"
              >
                Open portal
              </Link>
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

        {loading ? (
          <div className="glass-panel rounded-[2rem] p-6">
            <p className="text-sm text-slate-400">Loading weekly report...</p>
          </div>
        ) : null}

        {report ? (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Skill summary
                </p>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-[1.4rem] border border-emerald-300/20 bg-emerald-400/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">
                      Strongest skill
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white capitalize">
                      {labelSkill(report.strongest_skill.skill_name)}
                    </p>
                    <p className="mt-1 text-sm text-slate-200/90">
                      {report.strongest_skill.metric_value.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-orange-300/20 bg-orange-400/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-orange-100/80">
                      Weakest skill
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white capitalize">
                      {labelSkill(report.weakest_skill.skill_name)}
                    </p>
                    <p className="mt-1 text-sm text-slate-200/90">
                      {report.weakest_skill.metric_value.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Next-week goals
                </p>
                <div className="mt-5 space-y-3">
                  {report.next_week_goals.map((goal) => (
                    <div
                      key={goal}
                      className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4 text-sm leading-7 text-slate-200"
                    >
                      {goal}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Repeated mistakes
                </p>
                <div className="mt-5 space-y-3">
                  {report.repeated_mistakes.length ? (
                    report.repeated_mistakes.map((item) => (
                      <div
                        key={`${item.mistake_type}-${item.mistake_key}`}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">
                            {item.mistake_type.replaceAll("_", " ")}
                          </p>
                          <span className="text-xs text-slate-400">
                            {item.occurrence_count}x
                          </span>
                        </div>
                        {item.hint ? (
                          <p className="mt-2 text-sm leading-7 text-slate-200">
                            {item.hint}
                          </p>
                        ) : null}
                        {item.correction ? (
                          <p className="mt-2 text-sm leading-7 text-slate-300">
                            Correction: {item.correction}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No repeated mistakes logged this week.
                    </p>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Weekly trend
                </p>
                <div className="mt-5 space-y-4">
                  {report.weekly_trend.length ? (
                    report.weekly_trend.map((series) => (
                      <div
                        key={series.score_type}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4"
                      >
                        <p className="text-sm font-semibold text-white">
                          {series.score_type.replaceAll("_", " ")}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {series.points.map((point) => (
                            <div
                              key={`${series.score_type}-${point.label}`}
                              className="flex items-center justify-between rounded-[1.1rem] border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                            >
                              <span className="text-slate-400">{point.label}</span>
                              <span>{point.value.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No trend data yet. Run a few analyses this week to populate it.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

