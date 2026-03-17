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

const LEVEL_LABELS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  A1: { label: "Beginner",        color: "text-slate-300",   bg: "from-slate-500/20 to-slate-600/10",   desc: "You're just starting out. Foundation work is key." },
  A2: { label: "Elementary",      color: "text-blue-300",    bg: "from-blue-500/20 to-blue-600/10",     desc: "You know the basics and can handle simple situations." },
  B1: { label: "Intermediate",    color: "text-cyan-300",    bg: "from-cyan-500/20 to-cyan-600/10",     desc: "You can get your point across in most everyday situations." },
  B2: { label: "Upper-Intermediate", color: "text-teal-300", bg: "from-teal-500/20 to-teal-600/10",    desc: "You communicate confidently on a wide range of topics." },
  C1: { label: "Advanced",        color: "text-emerald-300", bg: "from-emerald-500/20 to-emerald-600/10", desc: "You use complex language with fluency and flexibility." },
  C2: { label: "Mastery",         color: "text-amber-300",   bg: "from-amber-500/20 to-amber-600/10",  desc: "Near-native precision. You can express anything with ease." },
};

const SKILL_ICONS: Record<string, string> = {
  grammar_accuracy: "📐",
  fluency: "🌊",
  vocabulary_diversity: "📚",
  confidence: "💪",
  sentence_complexity: "🧩",
  answer_completeness: "✅",
};

function skillLabel(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(v: number) {
  if (v >= 75) return "text-emerald-300";
  if (v >= 55) return "text-amber-300";
  return "text-rose-300";
}

function scoreBg(v: number) {
  if (v >= 75) return "bg-emerald-500";
  if (v >= 55) return "bg-amber-500";
  return "bg-rose-500";
}

/* ─── Skill breakdown bar ─── */
function SkillBar({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm text-slate-200">{label}</span>
        </div>
        <span className={`text-sm font-bold ${scoreColor(value)}`}>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${scoreBg(value)}`}
          style={{ width: `${Math.max(4, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Animated counter ─── */
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return count;
}

export default function AssessmentResultPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/assessment/result`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<AssessmentResult>(res);
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your result.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  const levelKey = result?.current_level ?? "B1";
  const levelMeta = LEVEL_LABELS[levelKey] ?? LEVEL_LABELS.B1;
  const skillEntries = Object.entries(result?.skill_breakdown ?? {});
  const sortedSkills = [...skillEntries].sort((a, b) => b[1] - a[1]);
  const topSkill = sortedSkills[0];
  const bottomSkill = sortedSkills[sortedSkills.length - 1];

  // Derive weaknesses from skills under 60
  const weaknesses = skillEntries.filter(([, v]) => v < 60).map(([k]) => k);
  const strengths = skillEntries.filter(([, v]) => v >= 65).map(([k]) => k);

  const avgScore = skillEntries.length
    ? skillEntries.reduce((s, [, v]) => s + v, 0) / skillEntries.length
    : 0;

  const displayAvg = useCountUp(Math.round(avgScore));

  if (loading) {
    return (
      <main className="app-shell grid-overlay min-h-screen flex items-center justify-center px-4 text-slate-100">
        <div className="text-center animate-pulse space-y-4">
          <div className="text-5xl">🎓</div>
          <p className="text-slate-400 text-sm">Loading your results…</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp 0.5s ease both; }
        .anim-1 { animation-delay: 0.1s; }
        .anim-2 { animation-delay: 0.2s; }
        .anim-3 { animation-delay: 0.3s; }
        .anim-4 { animation-delay: 0.4s; }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-8 text-slate-100 md:px-6 md:py-10">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">

          {/* ─── Hero: Level reveal ─── */}
          <div className={`anim glass-panel relative overflow-hidden rounded-[2rem] p-6 md:p-8`}>
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${levelMeta.bg} opacity-70`} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(105,226,255,0.12),transparent_50%)]" />

            <div className="relative">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">🎓 Assessment Complete</p>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-1">Your Level</p>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-7xl font-black leading-none ${levelMeta.color}`}>{levelKey}</span>
                    <span className="text-2xl font-bold text-white">{levelMeta.label}</span>
                  </div>
                </div>
                <div className="ml-auto text-right hidden sm:block">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Avg score</p>
                  <p className="text-4xl font-black text-white">{displayAvg}<span className="text-lg text-slate-500">/100</span></p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-300 leading-6">{levelMeta.desc}</p>
              {result?.completion_notes && (
                <p className="mt-2 text-sm text-slate-400 italic">&ldquo;{result.completion_notes}&rdquo;</p>
              )}
            </div>
          </div>

          {/* ─── Strengths & Weaknesses ─── */}
          <div className="anim anim-1 grid gap-4 sm:grid-cols-2">
            {/* Strengths */}
            <div className="glass-panel rounded-[2rem] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-400 font-medium mb-4">✅ Strengths</p>
              {strengths.length > 0 ? (
                <div className="space-y-2.5">
                  {strengths.slice(0, 3).map((k) => (
                    <div key={k} className="flex items-center gap-2.5 rounded-[1.1rem] border border-emerald-300/15 bg-emerald-500/8 px-3 py-2.5">
                      <span className="text-base">{SKILL_ICONS[k] ?? "✅"}</span>
                      <span className="text-sm text-emerald-100 capitalize">{skillLabel(k)}</span>
                      <span className="ml-auto text-xs text-emerald-400 font-semibold">{Math.round(result?.skill_breakdown[k] ?? 0)}</span>
                    </div>
                  ))}
                  {strengths.length === 0 && (
                    <p className="text-sm text-slate-500">Keep practicing to see your strengths grow.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Complete more sessions to unlock strength data.</p>
              )}

              {topSkill && (
                <div className="mt-4 rounded-[1.2rem] border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wider">Top skill</p>
                  <p className="text-base font-bold text-white mt-1 capitalize">
                    {SKILL_ICONS[topSkill[0]] ?? ""} {skillLabel(topSkill[0])}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Score: {Math.round(topSkill[1])}/100</p>
                </div>
              )}
            </div>

            {/* Weaknesses */}
            <div className="glass-panel rounded-[2rem] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-rose-400 font-medium mb-4">❌ Areas to Improve</p>
              {weaknesses.length > 0 ? (
                <div className="space-y-2.5">
                  {weaknesses.slice(0, 3).map((k) => (
                    <div key={k} className="flex items-center gap-2.5 rounded-[1.1rem] border border-rose-300/15 bg-rose-500/8 px-3 py-2.5">
                      <span className="text-base">{SKILL_ICONS[k] ?? "❌"}</span>
                      <span className="text-sm text-rose-100 capitalize">{skillLabel(k)}</span>
                      <span className="ml-auto text-xs text-rose-400 font-semibold">{Math.round(result?.skill_breakdown[k] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-emerald-400">Great — no major weak areas found! 🎉</p>
              )}

              {bottomSkill && weaknesses.length > 0 && (
                <div className="mt-4 rounded-[1.2rem] border border-rose-300/20 bg-rose-500/10 px-4 py-3">
                  <p className="text-[10px] text-rose-400 uppercase tracking-wider">Focus on</p>
                  <p className="text-base font-bold text-white mt-1 capitalize">
                    {SKILL_ICONS[bottomSkill[0]] ?? ""} {skillLabel(bottomSkill[0])}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Score: {Math.round(bottomSkill[1])}/100 — most room to grow</p>
                </div>
              )}
            </div>
          </div>

          {/* ─── Skill Breakdown ─── */}
          <div className="anim anim-2 glass-panel rounded-[2rem] p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400 mb-4">📊 Skill Breakdown</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedSkills.map(([key, val]) => (
                <SkillBar key={key} label={skillLabel(key)} value={val} icon={SKILL_ICONS[key] ?? "⭐"} />
              ))}
            </div>
          </div>

          {/* ─── Recommendation ─── */}
          <div className="anim anim-3 glass-panel rounded-[2rem] p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300 mb-4">🎯 What to do next</p>

            {result?.recommended_first_scenario && (
              <div className="rounded-[1.6rem] border border-cyan-300/20 bg-cyan-500/8 p-5 mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400 mb-2">→ Recommended scenario</p>
                <p className="text-xl font-bold text-white">{result.recommended_first_scenario}</p>
                <p className="mt-1 text-sm text-slate-400">This matches your current level and top weakness area.</p>
                {result.recommended_first_scenario_id && (
                  <Link
                    href="/portal"
                    className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200 transition"
                  >
                    ▶ Start this scenario
                  </Link>
                )}
              </div>
            )}

            {/* Weakness-based focus tips */}
            {weaknesses.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">→ Focus on</p>
                {weaknesses.slice(0, 2).map((k) => {
                  const tips: Record<string, string> = {
                    grammar_accuracy: "Practice subject-verb agreement. Write 2 sentences per day in past and present tense.",
                    fluency: "Aim for 4–6 connected sentences in each response. Use transition words.",
                    vocabulary_diversity: "Learn 3 new words per day. Avoid repeating the same verbs.",
                    confidence: "End every answer with a clear conclusion. Stop hedging with 'maybe' or 'I think'.",
                    sentence_complexity: "Combine ideas using 'because', 'although', or 'however'.",
                    answer_completeness: "Answer with: context → action → result. Never stop after one sentence.",
                  };
                  return (
                    <div key={k} className="rounded-[1.3rem] border border-white/8 bg-white/4 px-4 py-3 flex gap-3">
                      <span className="text-xl flex-shrink-0">{SKILL_ICONS[k] ?? "💡"}</span>
                      <div>
                        <p className="text-sm font-semibold text-white capitalize">{skillLabel(k)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{tips[k] ?? "Practice this skill in your next session."}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── 7-Day Plan (collapsible) ─── */}
          {(result?.seven_day_practice_suggestion?.length ?? 0) > 0 && (
            <div className="anim anim-4 glass-panel rounded-[2rem] p-5">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setShowPlan((p) => !p)}
                type="button"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">📅 7-Day Practice Plan</p>
                <span className="text-slate-500 text-sm">{showPlan ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {showPlan && (
                <div className="mt-5 space-y-3">
                  {result?.seven_day_practice_suggestion.map((item) => (
                    <div key={item.day} className="rounded-[1.4rem] border border-white/8 bg-slate-950/50 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-300/20 text-[11px] font-bold text-cyan-300">
                          {item.day}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">{item.focus}</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{item.action}</p>
                      <p className="text-xs text-slate-500 mt-1">Focus skill: {skillLabel(item.target_skill)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              ❌ {error}
            </div>
          )}

          {/* ─── CTA Buttons ─── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/portal"
              className="rounded-[1.4rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-4 text-center text-sm font-bold text-slate-950 transition hover:scale-[1.01]"
            >
              ▶ Start Practicing
            </Link>
            <Link
              href="/dashboard"
              className="rounded-[1.4rem] border border-white/10 bg-white/5 px-5 py-4 text-center text-sm font-medium text-white transition hover:border-cyan-300/25 hover:text-white"
            >
              📊 View Progress
            </Link>
          </div>

        </div>
      </main>
    </>
  );
}
