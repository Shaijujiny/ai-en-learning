"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   MODES HUB — The 4 unique experiences
   ═══════════════════════════════════════════════════════════ */

const MODES = [
  {
    id: "interview",
    href: "/interview",
    emoji: "💼",
    label: "Interview Mode",
    headline: "Real company-style interviews",
    description:
      "Face real behavioral and technical questions. AI follows up on weak answers, adapts to pressure mode, and gives recruiter-level feedback.",
    pills: ["Follow-up questions", "Pressure mode", "Recruiter feedback"],
    gradient: "from-violet-600/25 to-indigo-700/15",
    border: "border-violet-400/20",
    glow: "rgba(167,139,250,0.18)",
    ctaColor: "bg-violet-500",
    badge: "🔥 Most popular",
  },
  {
    id: "reallife",
    href: "/modes/reallife",
    emoji: "🌍",
    label: "Real Life Mode",
    headline: "Everyday situations in English",
    description:
      "Practice at the airport, office, coffee shop, or on a date. AI plays the other person — receptionist, colleague, barista, or date.",
    pills: ["Airport", "Office", "Dating", "Customer support"],
    gradient: "from-emerald-600/20 to-teal-700/12",
    border: "border-emerald-400/20",
    glow: "rgba(110,231,183,0.15)",
    ctaColor: "bg-emerald-500",
    badge: "🌍 Situational",
  },
  {
    id: "freeflow",
    href: "/modes/freeflow",
    emoji: "🗣️",
    label: "AI Speaking Partner",
    headline: "Talk freely — no script needed",
    description:
      "No scenario, no goal. Just start talking. The AI listens, responds naturally, and coaches you on fluency and vocabulary as you go.",
    pills: ["No rules", "Free conversation", "Live coaching"],
    gradient: "from-cyan-600/20 to-blue-700/12",
    border: "border-cyan-400/20",
    glow: "rgba(105,226,255,0.15)",
    ctaColor: "bg-cyan-500",
    badge: "✨ New",
  },
  {
    id: "replay",
    href: "/dashboard",
    emoji: "🔁",
    label: "Mistake Replay",
    headline: "Replay bad answers & fix them",
    description:
      "Review conversations where you struggled. Replay your worst messages, see corrections, and re-practice them right from the replay screen.",
    pills: ["Score each answer", "Grammar fix", "Re-practice weak moments"],
    gradient: "from-rose-600/18 to-orange-700/12",
    border: "border-rose-400/20",
    glow: "rgba(251,113,133,0.15)",
    ctaColor: "bg-rose-500",
    badge: "🎯 Practice",
  },
];

export default function ModesPage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = window.localStorage.getItem("token") ?? "";
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  return (
    <>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .mode-card:hover .mode-emoji { animation: float 2s ease infinite; }
      `}</style>

      <main className="app-shell grid-overlay min-h-screen px-4 py-8 text-slate-100 md:px-8">
        <div className="mx-auto max-w-5xl flex flex-col gap-8">

          {/* Header */}
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="ds-label ds-label-primary mb-1">🚀 Unique Experiences</p>
                <h1 className="display text-3xl font-black text-white md:text-4xl">Choose Your Mode</h1>
                <p className="mt-2 text-sm text-slate-400 max-w-lg">
                  Four different ways to practice English — each one designed to feel real.
                </p>
              </div>
              <Link href="/portal" className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-pill">← Portal</Link>
            </div>
          </div>

          {/* Mode cards */}
          <div className="grid gap-5 md:grid-cols-2">
            {MODES.map((mode, i) => (
              <Link
                key={mode.id}
                href={mode.href}
                className={`mode-card group relative flex flex-col overflow-hidden rounded-[2rem] border bg-gradient-to-br ${mode.gradient} ${mode.border} p-6 transition-all duration-300 hover:-translate-y-1`}
                style={{
                  animation: `fadeUp 0.4s ease ${i * 0.08}s both`,
                  boxShadow: `0 0 0 0 ${mode.glow}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${mode.glow}`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 0 transparent"; }}
              >
                {/* Badge */}
                <span className="absolute top-4 right-4 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-semibold text-slate-300">
                  {mode.badge}
                </span>

                {/* Emoji */}
                <div className="mode-emoji text-5xl mb-4 w-fit">{mode.emoji}</div>

                {/* Content */}
                <p className="ds-label mb-1">{mode.label}</p>
                <h2 className="text-xl font-bold text-white mb-2">{mode.headline}</h2>
                <p className="text-sm text-slate-400 leading-6 flex-1">{mode.description}</p>

                {/* Pills */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {mode.pills.map((pill) => (
                    <span key={pill} className="ds-tag ds-tag-neutral">{pill}</span>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white group-hover:text-slate-200 transition">
                    Start now →
                  </span>
                  <div className={`h-8 w-8 rounded-full ${mode.ctaColor} flex items-center justify-center text-white text-sm font-bold opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all`}>
                    →
                  </div>
                </div>

                {/* Hover overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-white/0 group-hover:bg-white/3 transition-all duration-300" />
              </Link>
            ))}
          </div>

          {/* Bottom nav */}
          <div style={{ animation: "fadeUp 0.4s ease 0.35s both" }}
            className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { href: "/portal",     label: "🏠 Home" },
              { href: "/daily",      label: "📅 Daily" },
              { href: "/dashboard",  label: "📊 Progress" },
              { href: "/speaking",   label: "🎤 Speaking" },
              { href: "/assessment", label: "📝 Assess" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="ds-btn ds-btn-ghost ds-btn-sm ds-btn-pill text-center justify-center">
                {label}
              </Link>
            ))}
          </div>

        </div>
      </main>
    </>
  );
}
