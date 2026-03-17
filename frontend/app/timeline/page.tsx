"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

type TimelineEvent =
  | {
      type: "mistake";
      category: "mistake";
      mistake_type: string;
      mistake_key: string;
      occurrence_count: number;
      hint: string | null;
      correction: string | null;
      created_at: string | null;
    }
  | {
      type: "drop" | "improvement";
      category: "score";
      score_type: string;
      value: number;
      delta: number;
      created_at: string;
    };

type TimelineResponse = {
  range_start: string;
  range_end: string;
  events: TimelineEvent[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function badgeStyle(event: TimelineEvent) {
  if (event.category === "mistake") {
    return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  }
  if (event.type === "drop") {
    return "border-rose-300/20 bg-rose-500/10 text-rose-100";
  }
  return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
}

function labelScoreType(value: string) {
  return value.replaceAll("_", " ");
}

export default function TimelinePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [days, setDays] = useState(14);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
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
        const response = await fetch(
          `${API_BASE_URL}/reports/timeline?days=${encodeURIComponent(days)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await readApiData<TimelineResponse>(response);
        setTimeline(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load timeline.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [days, token]);

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-5 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="glass-panel rounded-[2rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
            Coach timeline
          </p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="display text-4xl font-semibold text-white md:text-6xl">
                Mistakes and momentum
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Track mistakes, improvements, and score drops across recent sessions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-[1.2rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
              <Link
                className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white"
                href="/dashboard"
              >
                Back to dashboard
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
            <p className="text-sm text-slate-400">Loading timeline...</p>
          </div>
        ) : null}

        {timeline ? (
          <section className="glass-panel rounded-[2rem] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {timeline.range_start} to {timeline.range_end}
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                {timeline.events.length} events
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {timeline.events.length ? (
                timeline.events.map((event, index) => (
                  <div
                    key={`${event.category}-${index}`}
                    className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${badgeStyle(
                          event,
                        )}`}
                      >
                        {event.category === "mistake"
                          ? "Mistake"
                          : event.type === "drop"
                            ? "Drop"
                            : "Improvement"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(
                          (event.category === "mistake"
                            ? event.created_at
                            : event.created_at) ?? new Date().toISOString(),
                        ).toLocaleString()}
                      </span>
                    </div>

                    {event.category === "mistake" ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-white">
                          {event.mistake_type.replaceAll("_", " ")}{" "}
                          <span className="text-slate-400">
                            ({event.occurrence_count}x)
                          </span>
                        </p>
                        {event.hint ? (
                          <p className="mt-2 text-sm leading-7 text-slate-200">
                            {event.hint}
                          </p>
                        ) : null}
                        {event.correction ? (
                          <p className="mt-2 text-sm text-slate-300">
                            Correction: {event.correction}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-white">
                          {labelScoreType(event.score_type)}
                        </p>
                        <p className="mt-2 text-sm text-slate-200">
                          Value: {event.value.toFixed(1)} • Delta:{" "}
                          {event.delta.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No timeline events yet. Score a few answers to populate this feed.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

