"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

type PracticeRecommendation = {
  day: number;
  focus: string;
  action: string;
  target_skill: string;
};

type AssessmentResult = {
  session_id: number | null;
  status: string;
  current_level: string | null;
  strongest_skill: string | null;
  weakest_skill: string | null;
  recommended_first_scenario: string | null;
  recommended_first_scenario_id: number | null;
  seven_day_practice_suggestion: PracticeRecommendation[];
  skill_breakdown: Record<string, number>;
  score_summary: Record<string, string | number>;
  completion_notes: string | null;
  completed_at: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatSkillLabel(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return value.replaceAll("_", " ");
}

export default function AssessmentResultPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token") ?? "";
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadResult() {
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/assessment/result`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<AssessmentResult>(response);
        setResult(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load assessment result.",
        );
      }
    }

    void loadResult();
  }, [token]);

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="glass-panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
            Assessment Result
          </p>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="display text-4xl font-semibold text-white md:text-6xl">
                Your current English learning profile.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-300 md:text-base">
                This result is the starting point for scenario difficulty, coaching,
                and the first week of practice.
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-6">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                Estimated level
              </p>
              <p className="mt-4 text-6xl font-semibold text-white">
                {result?.current_level ?? "--"}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                {result?.completion_notes ?? "Assessment insights will appear here."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-3 text-sm font-semibold text-slate-950"
                  href="/portal"
                >
                  Open portal
                </Link>
                <Link
                  className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                  href="/dashboard"
                >
                  Open dashboard
                </Link>
              </div>
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

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Skill edges
              </p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.4rem] border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">
                    Strongest skill
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white capitalize">
                    {formatSkillLabel(result?.strongest_skill ?? null)}
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-orange-300/20 bg-orange-400/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-orange-100/80">
                    Weakest skill
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white capitalize">
                    {formatSkillLabel(result?.weakest_skill ?? null)}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Recommended first scenario
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-white">
                {result?.recommended_first_scenario ?? "Not available"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Start with the recommended scenario so the first sessions match your
                current level and the main skill that needs improvement.
              </p>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Skill breakdown
              </p>
              <div className="mt-5 space-y-3">
                {Object.entries(result?.skill_breakdown ?? {}).map(([skill, value]) => (
                  <div key={skill}>
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="capitalize">{skill.replaceAll("_", " ")}</span>
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
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                7-Day Practice Suggestion
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                First week
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {result?.seven_day_practice_suggestion.map((item) => (
                <div
                  key={item.day}
                  className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      Day {item.day}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                      {item.focus}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-white">
                    {item.action}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Target skill: {item.target_skill.replaceAll("_", " ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
