"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readApiData } from "@/lib/api";

/* ─── Types ─── */
type LevelInfo = {
  level: number;
  title: string;
  icon: string;
  min_xp: number;
  next_level: number | null;
  next_min_xp: number | null;
  xp_to_next: number;
  progress_pct: number;
};

type DailyStatus = {
  today: string;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  level_info: LevelInfo;
  tasks: {
    conversation: boolean;
    vocabulary: boolean;
    speaking: boolean;
    review: boolean;
  };
  completed_count: number;
  total_tasks: number;
  daily_xp_earned: number;
  daily_xp_possible: number;
};

type CompleteResult = {
  task_id: string;
  already_done: boolean;
  awarded_xp: number;
  leveled_up: boolean;
  total_xp: number;
  current_streak: number;
  level_info: LevelInfo;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ─── Level color map ─── */
const LEVEL_COLORS: Record<number, string> = {
  1:  "from-slate-400 to-slate-500",
  2:  "from-blue-400 to-blue-500",
  3:  "from-cyan-400 to-cyan-500",
  4:  "from-teal-400 to-emerald-500",
  5:  "from-emerald-400 to-green-500",
  6:  "from-violet-400 to-purple-500",
  7:  "from-amber-400 to-orange-500",
  8:  "from-rose-400 to-pink-500",
  9:  "from-indigo-400 to-violet-500",
  10: "from-yellow-400 to-amber-500",
};

const ALL_LEVELS = [
  { level: 1,  title: "Beginner",     icon: "🌱" },
  { level: 2,  title: "Learner",      icon: "📖" },
  { level: 3,  title: "Speaker",      icon: "💬" },
  { level: 4,  title: "Communicator", icon: "🗣️" },
  { level: 5,  title: "Conversant",   icon: "✨" },
  { level: 6,  title: "Fluent",       icon: "🌊" },
  { level: 7,  title: "Expert",       icon: "🎯" },
  { level: 8,  title: "Master",       icon: "🏆" },
  { level: 9,  title: "Elite",        icon: "💎" },
  { level: 10, title: "Champion",     icon: "👑" },
];

/* ─── Daily tasks definition ─── */
type DayTask = {
  id: "conversation" | "vocabulary" | "speaking" | "review";
  emoji: string;
  title: string;
  description: string;
  xp: number;
  action: string;
  actionHref: string;
};

const BASE_TASKS: DayTask[] = [
  {
    id: "conversation",
    emoji: "💬",
    title: "Complete 1 Conversation",
    description: "Practice speaking with your AI coach in any scenario",
    xp: 50,
    action: "Start Practice",
    actionHref: "/portal",
  },
  {
    id: "vocabulary",
    emoji: "📖",
    title: "Learn 5 Vocabulary Words",
    description: "Review and use 5 new words in a sentence",
    xp: 20,
    action: "Go to Portal",
    actionHref: "/portal",
  },
  {
    id: "speaking",
    emoji: "🎙️",
    title: "Complete a Speaking Test",
    description: "Record yourself and get AI feedback on your pronunciation",
    xp: 30,
    action: "Take Test",
    actionHref: "/assessment",
  },
  {
    id: "review",
    emoji: "🔁",
    title: "Review a Past Mistake",
    description: "Check your mistake memory and practice the correction",
    xp: 15,
    action: "View Mistakes",
    actionHref: "/dashboard",
  },
];

/* ─── Streak calendar (last 7 days) ─── */
function buildWeekDays(lastActiveDateStr: string | null, streak: number) {
  const today = new Date();
  const lastActive = lastActiveDateStr ? new Date(lastActiveDateStr) : null;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const isToday = i === 6;
    // Approximate past active days from streak count
    const daysAgo = 6 - i;
    const active = isToday
      ? (lastActive !== null && lastActive.toDateString() === today.toDateString())
      : daysAgo < streak;
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: d.getDate(),
      isToday,
      active,
    };
  });
}

/* ─── XP Toast ─── */
function XpToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-amber-300/30 bg-amber-500/15 px-5 py-3 shadow-2xl backdrop-blur-xl"
      style={{ animation: "toastIn 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <span className="text-2xl">⚡</span>
      <span className="text-sm font-bold text-amber-200">+{xp} XP earned!</span>
    </div>
  );
}

/* ─── Level-up modal ─── */
function LevelUpModal({ info, onClose }: { info: LevelInfo; onClose: () => void }) {
  const color = LEVEL_COLORS[info.level] ?? "from-amber-400 to-orange-500";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-[2rem] border border-white/15 bg-slate-950 p-8 text-center"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "levelUp 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_65%)]" />
        <div className="relative">
          <div className="text-6xl mb-4" style={{ animation: "bounce 0.8s ease infinite" }}>
            {info.icon}
          </div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold">Level Up!</p>
          <h2 className="mt-2 text-3xl font-black text-white">Level {info.level}</h2>
          <p className={`text-lg font-semibold mt-1 bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
            {info.title}
          </p>
          <p className="mt-3 text-sm text-slate-400">You&apos;re improving every day. Keep the streak going!</p>
          <button
            className="mt-6 w-full rounded-[1.3rem] bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
            onClick={onClose}
            type="button"
          >
            Let&apos;s go! →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton loader ─── */
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[1rem] bg-white/6 ${className ?? ""}`} />;
}

export default function DailyPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<LevelInfo | null>(null);

  /* Load token */
  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  /* Fetch daily status */
  const fetchStatus = useCallback(async (tok: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/daily/status`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = await readApiData<DailyStatus>(res);
      setStatus(data);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void fetchStatus(token);
  }, [token, fetchStatus]);

  /* Mark task complete */
  async function completeTask(taskId: string) {
    if (!token || completing) return;
    setCompleting(taskId);
    try {
      const res = await fetch(`${API_BASE_URL}/daily/complete/${taskId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await readApiData<CompleteResult>(res);

      if (!result.already_done && result.awarded_xp > 0) {
        setXpToast(result.awarded_xp);
        if (result.leveled_up) {
          setTimeout(() => setLevelUpInfo(result.level_info), 800);
        }
      }

      // Refresh status
      await fetchStatus(token);
    } catch {
      // ignore
    } finally {
      setCompleting(null);
    }
  }

  const levelColor = status
    ? (LEVEL_COLORS[status.level_info.level] ?? "from-amber-400 to-orange-500")
    : "from-slate-400 to-slate-500";

  const streak = status?.current_streak ?? 0;
  const streakMilestone = streak >= 30 ? "🔥🔥🔥" : streak >= 14 ? "🔥🔥" : "🔥";

  const weekDays = useMemo(
    () => buildWeekDays(status?.last_active_date ?? null, streak),
    [status?.last_active_date, streak],
  );

  const activeToday = useMemo(() => {
    if (!status?.last_active_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    return status.last_active_date === today || status.daily_xp_earned > 0;
  }, [status]);

  return (
    <>
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes levelUp { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes xpFill { from{width:0} }
        .anim { animation: fadeUp 0.4s ease both; }
        .anim-1 { animation-delay: 0.06s }
        .anim-2 { animation-delay: 0.12s }
        .anim-3 { animation-delay: 0.18s }
        .anim-4 { animation-delay: 0.24s }
      `}</style>

      {xpToast !== null && <XpToast xp={xpToast} onDone={() => setXpToast(null)} />}
      {levelUpInfo && <LevelUpModal info={levelUpInfo} onClose={() => setLevelUpInfo(null)} />}

      <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-6 md:py-8">
        <div className="mx-auto max-w-lg flex flex-col gap-6">

          {/* ─── Header ─── */}
          <div className="anim flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Daily System</p>
              <h1 className="text-xl font-bold text-white mt-0.5">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h1>
            </div>
            <Link
              href="/portal"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/30 hover:text-white transition"
            >
              ← Back
            </Link>
          </div>

          {/* ─── Level card ─── */}
          <div className={`anim anim-1 relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${levelColor} p-[1px]`}>
            <div className="rounded-[2rem] bg-slate-950/90 p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.12),transparent_55%)]" />
              <div className="relative">
                {loading || !status ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-7 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${levelColor} text-3xl shadow-lg`}>
                          {status.level_info.icon}
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Level {status.level_info.level}</p>
                          <p className="text-xl font-black text-white">{status.level_info.title}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500">Total XP</p>
                        <p className="text-2xl font-black text-white">
                          {status.total_xp.toLocaleString()}
                          <span className="text-xs text-slate-500 ml-1">XP</span>
                        </p>
                      </div>
                    </div>

                    {/* XP bar */}
                    <div className="mt-5">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                        <span>Level {status.level_info.level}</span>
                        {status.level_info.next_level
                          ? <span>Level {status.level_info.next_level} · {status.level_info.xp_to_next} XP to go</span>
                          : <span>Max level reached! 👑</span>
                        }
                      </div>
                      <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${levelColor} transition-all duration-1000`}
                          style={{ width: `${Math.max(3, status.level_info.progress_pct)}%`, animation: "xpFill 1s ease both" }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                        <span>{status.level_info.min_xp} XP</span>
                        {status.level_info.next_min_xp && <span>{status.level_info.next_min_xp} XP</span>}
                      </div>
                    </div>

                    {/* Level icon grid */}
                    <div className="mt-5 flex gap-1.5 flex-wrap">
                      {ALL_LEVELS.map((lvl) => (
                        <div
                          key={lvl.level}
                          title={`Level ${lvl.level}: ${lvl.title}`}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition ${
                            lvl.level <= status.level_info.level
                              ? `bg-gradient-to-br ${LEVEL_COLORS[lvl.level] ?? ""} opacity-100`
                              : "bg-white/5 opacity-25"
                          }`}
                        >
                          {lvl.icon}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ─── Streak card ─── */}
          <div className="anim anim-2 glass-panel rounded-[2rem] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{streakMilestone}</span>
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Daily Streak</p>
                  {loading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-3xl font-black text-white leading-none">
                      {streak}<span className="text-sm text-slate-500 ml-1">days</span>
                    </p>
                  )}
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                activeToday
                  ? "border-emerald-300/25 bg-emerald-500/12 text-emerald-300"
                  : "border-amber-300/25 bg-amber-500/10 text-amber-300"
              }`}>
                {activeToday ? "✅ Active today" : "⚡ Not yet today"}
              </div>
            </div>

            {/* 7-day calendar */}
            <div className="grid grid-cols-7 gap-1.5">
              {loading
                ? Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="rounded-[0.75rem] bg-white/5 h-14 animate-pulse" />
                  ))
                : weekDays.map((day) => (
                    <div
                      key={day.label}
                      className={`flex flex-col items-center justify-center rounded-[0.9rem] py-2 gap-0.5 border transition ${
                        day.isToday
                          ? "border-cyan-300/30 bg-cyan-500/15"
                          : day.active
                            ? "border-emerald-300/20 bg-emerald-500/12"
                            : "border-white/5 bg-white/3 opacity-40"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider text-slate-500">{day.label}</span>
                      <span className={`text-sm font-bold ${day.isToday ? "text-cyan-300" : day.active ? "text-emerald-300" : "text-slate-600"}`}>
                        {day.day}
                      </span>
                      <span className="text-[11px]">{day.active ? "🔥" : "·"}</span>
                    </div>
                  ))
              }
            </div>

            {streak >= 7 && (
              <div className="mt-4 rounded-[1.3rem] border border-amber-300/15 bg-amber-500/8 px-4 py-2.5 text-center">
                <p className="text-xs text-amber-200 font-medium">
                  🏅 {streak >= 30 ? "30-day" : streak >= 14 ? "2-week" : "1-week"} streak milestone — keep going!
                </p>
              </div>
            )}
          </div>

          {/* ─── Daily Plan ─── */}
          <div className="anim anim-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">📅 Today&apos;s Plan</p>
                {status && (
                  <p className="text-sm text-slate-400 mt-0.5">
                    {status.completed_count}/{status.total_tasks} complete · +{status.daily_xp_earned}/{status.daily_xp_possible} XP today
                  </p>
                )}
              </div>
              {status && (
                <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  status.completed_count === status.total_tasks
                    ? "border-emerald-300/25 bg-emerald-500/12 text-emerald-300"
                    : "border-white/10 bg-white/5 text-slate-400"
                }`}>
                  {status.completed_count === status.total_tasks
                    ? "🎉 All done!"
                    : `${status.total_tasks - status.completed_count} left`}
                </div>
              )}
            </div>

            {/* Overall progress bar */}
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)] transition-all duration-700"
                style={{ width: status ? `${(status.completed_count / status.total_tasks) * 100}%` : "0%" }}
              />
            </div>

            {/* Task cards */}
            <div className="space-y-3">
              {BASE_TASKS.map((task, i) => {
                const done = status?.tasks[task.id] ?? false;
                const isCompleting = completing === task.id;
                return (
                  <div
                    key={task.id}
                    className={`rounded-[1.75rem] border transition-all duration-300 ${
                      done
                        ? "border-emerald-300/20 bg-emerald-500/8 opacity-75"
                        : "border-white/8 bg-white/4 hover:border-white/15"
                    }`}
                    style={{ animation: `fadeUp 0.4s ease ${i * 0.07}s both` }}
                  >
                    <div className="flex items-start gap-4 p-5">
                      <div className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${
                        done ? "bg-emerald-500/20" : "bg-white/8"
                      }`}>
                        {done ? "✅" : task.emoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${done ? "line-through text-slate-500" : "text-white"}`}>
                            {task.title}
                          </p>
                          <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            +{task.xp} XP
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-5">{task.description}</p>

                        {!done && (
                          <div className="mt-3 flex gap-2">
                            <Link
                              href={task.actionHref}
                              className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition font-medium"
                            >
                              {task.action} →
                            </Link>
                            <button
                              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-400 hover:border-emerald-300/20 hover:text-emerald-300 transition disabled:opacity-50"
                              onClick={() => void completeTask(task.id)}
                              disabled={isCompleting || !!completing}
                              type="button"
                            >
                              {isCompleting ? "Saving…" : "Mark done ✓"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All done reward */}
            {status && status.completed_count === status.total_tasks && (
              <div
                className="mt-4 rounded-[1.75rem] border border-amber-300/20 bg-amber-500/10 p-5 text-center"
                style={{ animation: "fadeUp 0.5s ease both" }}
              >
                <div className="text-4xl mb-2" style={{ animation: "bounce 1s ease infinite" }}>🎉</div>
                <p className="text-base font-bold text-white">Daily plan complete!</p>
                <p className="text-sm text-amber-300 mt-1">
                  +{status.daily_xp_earned} XP earned today · Streak maintained 🔥
                </p>
                <Link
                  href="/portal"
                  className="mt-4 inline-block rounded-full bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] px-6 py-2.5 text-sm font-bold text-slate-950 hover:scale-[1.02] transition"
                >
                  Keep going →
                </Link>
              </div>
            )}
          </div>

          {/* ─── Stats row ─── */}
          {status && (
            <div className="anim anim-4 grid grid-cols-3 gap-3">
              {[
                { label: "Streak", value: `${streak}🔥`, sub: "days" },
                { label: "Total XP", value: status.total_xp.toLocaleString(), sub: "points" },
                { label: "Longest", value: `${status.longest_streak}`, sub: "day best" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-lg font-black text-white mt-1">{value}</p>
                  <p className="text-[10px] text-slate-600">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* ─── Navigation shortcuts ─── */}
          <div className="anim grid grid-cols-3 gap-3 pb-6">
            {[
              { icon: "💬", label: "Practice", href: "/portal" },
              { icon: "📊", label: "Progress", href: "/dashboard" },
              { icon: "🧠", label: "Assessment", href: "/assessment" },
            ].map(({ icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-white/8 bg-white/4 py-4 text-slate-400 hover:border-cyan-300/20 hover:text-white transition"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-xs">{label}</span>
              </Link>
            ))}
          </div>

        </div>
      </main>
    </>
  );
}
