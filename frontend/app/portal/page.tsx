"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

type ConversationLanguage = "English" | "Spanish" | "French" | "German";
type CorrectionMode =
  | "no_interruption"
  | "correct_every_answer"
  | "delayed"
  | "major_mistakes_only";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const DIFFICULTY_STYLES: Record<Scenario["difficulty"], string> = {
  Beginner: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  Intermediate: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
  Advanced: "border-orange-300/25 bg-orange-400/10 text-orange-100",
};

const LANGUAGES: ConversationLanguage[] = [
  "English",
  "Spanish",
  "French",
  "German",
];

export default function PortalPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [language, setLanguage] = useState<ConversationLanguage>("English");
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("delayed");
  const [baseScenarioId, setBaseScenarioId] = useState<number>(1);
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<number | "custom" | null>(null);
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100
      ) {
        setVisibleCount((prev) => Math.min(prev + 4, scenarios.length));
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scenarios.length]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token") ?? "";
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadPortal() {
      setError("");

      const headers = { Authorization: `Bearer ${token}` };
      const [meResponse, scenariosResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/me`, { headers }),
        fetch(`${API_BASE_URL}/scenarios`),
      ]);

      try {
        const [meData, scenarioData] = await Promise.all([
          readApiData<User>(meResponse),
          readApiData<{ items: Scenario[] }>(scenariosResponse),
        ]);

        if (meData.assessment_status === "pending") {
          router.replace("/assessment");
          return;
        }

        const items = scenarioData.items ?? [];
        setUser(meData);
        setScenarios(items);
        if (items.length > 0) {
          setBaseScenarioId((current) => current || items[0].id);
        }
      } catch {
        setError("Failed to load user portal.");
      }
    }

    void loadPortal();
  }, [router, token]);

  async function startConversation(
    scenarioId: number,
    options?: { customTitle?: string; customPrompt?: string },
  ) {
    if (!token) {
      router.push("/login");
      return;
    }

    setStartingId(options?.customPrompt ? "custom" : scenarioId);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/conversations/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scenario_id: scenarioId,
          language,
          custom_title: options?.customTitle?.trim() || null,
          custom_prompt: options?.customPrompt?.trim() || null,
          correction_mode: correctionMode,
        }),
      });

      const data = await readApiData<{ id: number }>(response);
      router.push(`/chat/${data.id}`);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to start conversation.",
      );
    } finally {
      setStartingId(null);
    }
  }

  const selectedScenario =
    scenarios.find((scenario) => scenario.id === baseScenarioId) ?? scenarios[0] ?? null;

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-4 text-slate-100 md:px-6 md:py-6">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="glass-panel overflow-hidden rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
                User Portal
              </p>
              <h1 className="display mt-4 text-5xl font-semibold text-white md:text-6xl">
                Run sharper practice sessions without a cluttered layout.
              </h1>
              <p className="mt-5 text-base leading-8 text-slate-300">
                {user
                  ? `Welcome ${user.full_name}. Choose a scenario, switch the conversation language, or write a custom prompt for a more targeted session.`
                  : "Log in to open your practice workspace."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Active User
                </p>
                <p className="mt-2 text-lg font-medium text-white">
                  {user?.full_name ?? "Loading"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {user?.email ?? "Fetching account"}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-cyan-300">
                  {user?.user_level ? `Level ${user.user_level}` : "Assessment not completed"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Session Mode
                </p>
                <p className="mt-2 text-lg font-medium text-white">Voice + text</p>
                <p className="mt-1 text-sm text-slate-400">Scenario-led practice</p>
                <Link
                  className="mt-4 inline-flex w-full items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                  href="/speaking"
                >
                  Open Speaking Excellence
                </Link>
              </div>
              <Link
                className="rounded-[1.2rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                href="/dashboard"
              >
                Open dashboard
              </Link>
              <button
                className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white"
                onClick={() => {
                  window.localStorage.removeItem("token");
                  router.push("/login");
                }}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {!token ? (
          <div className="glass-panel rounded-[2rem] p-8">
            <p className="text-sm text-slate-300">
              No user session found. Go to{" "}
              <Link className="text-cyan-300" href="/login">
                login
              </Link>
              .
            </p>
          </div>
        ) : null}

        <section className="glass-panel rounded-[2rem] p-5 md:p-6">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,19,34,0.75),rgba(10,14,28,0.92))] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Conversation Director
              </p>
              <h2 className="display mt-4 text-4xl font-semibold text-white md:text-5xl">
                Scenario-first practice with custom prompt control.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300">
                Pick a structured scenario or overlay your own interview brief,
                coaching style, and follow-up rules for the AI.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {LANGUAGES.map((label) => (
                  <button
                    key={label}
                    className={`rounded-full border px-3 py-2 text-xs transition ${
                      language === label
                        ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-slate-300"
                    }`}
                    onClick={() => setLanguage(label)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {(
                  [
                    { value: "no_interruption", label: "No interruption" },
                    { value: "correct_every_answer", label: "Correct every answer" },
                    { value: "delayed", label: "Delayed corrections" },
                    { value: "major_mistakes_only", label: "Major mistakes only" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    className={`rounded-full border px-3 py-2 text-xs transition ${
                      correctionMode === item.value
                        ? "border-orange-300/40 bg-orange-400/15 text-orange-100"
                        : "border-white/10 bg-white/5 text-slate-300"
                    }`}
                    onClick={() => setCorrectionMode(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-6">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                Live Brief
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-white">
                {selectedScenario?.title ?? "No scenario selected"}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {selectedScenario?.description ?? "Choose a base scenario to shape the conversation."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
                    selectedScenario
                      ? DIFFICULTY_STYLES[selectedScenario.difficulty]
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  {selectedScenario?.difficulty ?? "Preset"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  {language}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  {correctionMode.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Prompt Layers
                  </p>
                  <p className="mt-2 text-xl font-medium text-white">4</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Response Mode
                  </p>
                  <p className="mt-2 text-xl font-medium text-white">Adaptive</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
          <section className="grid gap-4 md:grid-cols-2">
            {scenarios.slice(0, visibleCount).map((scenario, index) => (
              <button
                key={scenario.id}
                className="glass-panel group relative overflow-hidden rounded-[2rem] p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30"
                onClick={() => void startConversation(scenario.id)}
                type="button"
              >
                <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(105,226,255,0.14),transparent_72%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                <div className="relative">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Scenario {String(index + 1).padStart(2, "0")}
                  </p>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <h2 className="display max-w-[12ch] text-4xl font-semibold text-white">
                      {scenario.title}
                    </h2>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${DIFFICULTY_STYLES[scenario.difficulty]}`}
                    >
                      {scenario.difficulty}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {scenario.description}
                  </p>
                  <div className="mt-8 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Delivery
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {language} voice + text
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition group-hover:bg-cyan-200">
                      {startingId === scenario.id ? "Starting..." : "Launch"}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {visibleCount < scenarios.length && (
              <div className="col-span-full py-10 flex justify-center">
                <button
                  className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm text-slate-300 hover:border-cyan-300/40 hover:text-white transition"
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 4, scenarios.length))}
                  type="button"
                >
                  Load more scenarios...
                </button>
              </div>
            )}
          </section>

          <section className="glass-panel rounded-[2rem] p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Custom Builder
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Design your own conversation rules
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                Prompt Lab
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Use a base scenario for structure, then write the extra prompt
              instructions the AI should follow for this session.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Base Scenario
                </span>
                <select
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                  onChange={(event) => setBaseScenarioId(Number(event.target.value))}
                  value={baseScenarioId}
                >
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Session Title
                </span>
                <input
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                  onChange={(event) => setCustomTitle(event.target.value)}
                  placeholder="Senior backend interview"
                  value={customTitle}
                />
              </label>
            </div>

            <label className="mt-4 block rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Instruction Prompt
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  {customPrompt.length} / 5000 characters
                </span>
              </div>
              <textarea
                className="mt-3 min-h-56 w-full rounded-[1rem] border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none"
                maxLength={5000}
                onChange={(event) => setCustomPrompt(event.target.value)}
                placeholder="Example: Act like a senior engineering manager interviewing me for a backend platform role. Ask one question at a time, push deeper on weak answers, focus on architecture, tradeoffs, and reliability."
                value={customPrompt}
              />
            </label>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,28,0.7),rgba(7,14,24,0.92))] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Prompt Flow
              </p>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
                <p>1. Scenario preset defines the base context and role.</p>
                <p>2. Your custom prompt adds session-specific behavior and goals.</p>
                <p>3. Language selection sets the response language.</p>
                <p>4. Recent messages are included to preserve memory and continuity.</p>
              </div>
            </div>

            <button
              className="mt-5 w-full rounded-[1.35rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-4 text-sm font-medium text-slate-950 disabled:opacity-50"
              disabled={
                !token ||
                !baseScenarioId ||
                !customPrompt.trim() ||
                startingId === "custom"
              }
              onClick={() =>
                void startConversation(baseScenarioId, {
                  customTitle,
                  customPrompt,
                })
              }
              type="button"
            >
              {startingId === "custom"
                ? "Starting custom session..."
                : "Launch custom conversation"}
            </button>

            {error ? (
              <p className="mt-4 rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
