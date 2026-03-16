"use client";

import { FormEvent, useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

type Scenario = {
  id: number;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  system_prompt: string;
};

type AdminUsage = {
  total_users: number;
  total_conversations: number;
  total_messages: number;
  total_scores: number;
  language_usage: Record<string, number>;
};

type AdminAnalytics = {
  average_performance_score: number;
  total_skill_metrics: number;
  top_skill_metrics: Array<{ skill_name: string; metric_value: number }>;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const EMPTY_FORM = {
  title: "",
  description: "",
  difficulty: "Beginner" as Scenario["difficulty"],
  system_prompt: "",
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("token") ?? "";
    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function loadAdminData() {
      setLoading(true);
      setError("");

      const headers = { Authorization: `Bearer ${token}` };
      const [scenarioRes, usageRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/scenarios`, { headers }),
        fetch(`${API_BASE_URL}/admin/usage`, { headers }),
        fetch(`${API_BASE_URL}/admin/analytics`, { headers }),
      ]);

      try {
        const [scenarioData, usageData, analyticsData] = await Promise.all([
          readApiData<Scenario[]>(scenarioRes),
          readApiData<AdminUsage>(usageRes),
          readApiData<AdminAnalytics>(analyticsRes),
        ]);
        setScenarios(scenarioData);
        setUsage(usageData);
        setAnalytics(analyticsData);
        setLoading(false);
      } catch {
        setError("Failed to load admin data. Confirm this user is an admin.");
        setLoading(false);
      }
    }

    void loadAdminData();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const method = editingId ? "PUT" : "POST";
    const url = editingId
      ? `${API_BASE_URL}/admin/scenarios/${editingId}`
      : `${API_BASE_URL}/admin/scenarios`;

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(form),
    });

    let saved: Scenario;
    try {
      saved = await readApiData<Scenario>(response);
    } catch {
      setError("Failed to save scenario.");
      return;
    }
    setScenarios((current) => {
      if (editingId) {
        return current.map((scenario) =>
          scenario.id === saved.id ? saved : scenario,
        );
      }
      return [...current, saved];
    });
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  return (
    <main className="app-shell grid-overlay px-5 py-6 text-slate-100 md:px-8 md:py-8">
      <section className="mx-auto max-w-6xl">
        <div className="glass-panel mb-8 rounded-[2rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
            Admin Panel
          </p>
          <h1 className="display mt-2 text-4xl font-semibold text-white">
            Manage scenarios and platform analytics
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Operate the scenario catalog, review usage patterns, and monitor
            platform health from one control surface.
          </p>
        </div>

        {!token ? (
          <p className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Log in with an admin account first at /admin/login.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading admin panel...</p>
        ) : null}
        {error ? (
          <p className="mb-6 rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {usage && analytics ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                Usage
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-200">
                <p>Users: {usage.total_users}</p>
                <p>Conversations: {usage.total_conversations}</p>
                <p>Messages: {usage.total_messages}</p>
                <p>Scores: {usage.total_scores}</p>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                Analytics
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-200">
                <p>Average score: {analytics.average_performance_score.toFixed(1)}</p>
                <p>Skill metrics: {analytics.total_skill_metrics}</p>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
                Language Usage
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-200">
                {Object.keys(usage.language_usage).length === 0 ? (
                  <p>No language data yet.</p>
                ) : (
                  Object.entries(usage.language_usage).map(([language, count]) => (
                    <p key={language}>
                      {language}: {count}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.2fr]">
          <form className="glass-panel rounded-[2rem] p-6" onSubmit={handleSubmit}>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
              {editingId ? "Edit Scenario" : "Create Scenario"}
            </p>
            <div className="mt-4 space-y-4">
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Title"
                value={form.title}
              />
              <textarea
                className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Description"
                value={form.description}
              />
              <select
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) =>
                  setForm({
                    ...form,
                    difficulty: event.target.value as Scenario["difficulty"],
                  })
                }
                value={form.difficulty}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
              <textarea
                className="min-h-36 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) =>
                  setForm({ ...form, system_prompt: event.target.value })
                }
                placeholder="System prompt"
                value={form.system_prompt}
              />
              <button
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-3 font-medium text-slate-950"
                type="submit"
              >
                {editingId ? "Update scenario" : "Create scenario"}
              </button>
            </div>
          </form>

          <div className="glass-panel rounded-[2rem] p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
              Scenario Management
            </p>
            <div className="mt-4 space-y-4">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  className="block w-full rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4 text-left transition hover:border-cyan-300/40 hover:bg-slate-900/65"
                  onClick={() => {
                    setEditingId(scenario.id);
                    setForm({
                      title: scenario.title,
                      description: scenario.description,
                      difficulty: scenario.difficulty,
                      system_prompt: scenario.system_prompt,
                    });
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-medium text-white">
                      {scenario.title}
                    </h2>
                    <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
                      {scenario.difficulty}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
