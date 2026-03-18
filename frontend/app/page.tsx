"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mic, Briefcase, Globe, RotateCcw, Sparkles } from "lucide-react";

export default function Home() {
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(window.localStorage.getItem("token") ?? "");
  }, []);

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 pb-24 text-slate-100 overflow-hidden relative flex flex-col items-center">
      {/* Massive Top Glow for the airy/bright header effect */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[140%] md:w-[100%] h-[800px] bg-[radial-gradient(ellipse_at_top,rgba(224,242,254,0.3)_0%,rgba(105,226,255,0.15)_30%,transparent_70%)] pointer-events-none z-0" />

      {/* Hero Section */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center text-center gap-6 relative z-10 pt-20 md:pt-32">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-1.5 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-cyan-300">
            The Next-Gen Masterclass
          </p>
        </div>
        
        <h1 className="mt-4 display max-w-4xl text-5xl font-extrabold tracking-tight text-white md:text-7xl lg:text-8xl leading-[1.05] drop-shadow-lg">
          Master English with <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]">
            Advanced AI Avatars
          </span>
        </h1>
        
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-slate-300 font-medium mt-4 mix-blend-plus-lighter">
          Prepare for real-world scenarios. Nail your next job interview, navigate an 
          airport, or talk freely with an AI partner. Instant feedback, mistake replays, 
          and adaptive pressure modes.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Link
            className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-8 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(105,226,255,0.4)] transition hover:shadow-[0_0_30px_rgba(105,226,255,0.6)] hover:scale-105"
            href={token ? "/portal" : "/login"}
          >
            {token ? "Enter User Portal" : "Start Practicing Now"}
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          {!token && (
            <Link
              className="inline-flex items-center justify-center rounded-full border border-white/5 bg-slate-900/50 backdrop-blur-md px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800/80 hover:scale-105"
              href="/register"
            >
              Create Free Account
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto w-full max-w-5xl mt-32 relative z-10">
        <p className="text-center text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-10 font-bold">Platform Capabilities</p>
        <div className="grid md:grid-cols-2 gap-6 w-full">
          <div className="glass-panel group rounded-[2rem] p-8 md:p-10 border border-white/5 bg-slate-900/40 backdrop-blur-xl transition hover:bg-slate-800/40">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition">
              <Briefcase className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Interview Mode</h3>
            <p className="text-slate-400 leading-relaxed font-light text-[14px]">
              Experience real company-style interviews. Face dynamic follow-up contextual questions and test your limits with our unique <strong className="text-indigo-300 font-medium">Pressure Mode</strong>.
            </p>
          </div>

          <div className="glass-panel group rounded-[2rem] p-8 md:p-10 border border-white/5 bg-slate-900/40 backdrop-blur-xl transition hover:bg-slate-800/40">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Real Life Mode</h3>
            <p className="text-slate-400 leading-relaxed font-light text-[14px]">
              Navigate everyday English challenges. Complete specialized scenarios in the <strong className="text-emerald-300 font-medium">Airport, Office, Dating, or Customer Support</strong>.
            </p>
          </div>

          <div className="glass-panel group rounded-[2rem] p-8 md:p-10 border border-white/5 bg-slate-900/40 backdrop-blur-xl transition hover:bg-slate-800/40">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-6 text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">AI Speaking Partner</h3>
            <p className="text-slate-400 leading-relaxed font-light text-[14px]">
              Just want to talk? Use the Freeflow mode to chat naturally without constraints. It&apos;s like a language exchange partner that&apos;s available 24/7.
            </p>
          </div>

          <div className="glass-panel group rounded-[2rem] p-8 md:p-10 border border-white/5 bg-slate-900/40 backdrop-blur-xl transition hover:bg-slate-800/40">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-6 text-rose-400 group-hover:scale-110 group-hover:bg-rose-500/20 transition">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Mistake Replay</h3>
            <p className="text-slate-400 leading-relaxed font-light text-[14px]">
              Every mistake is an opportunity. Instantly revisit your flawed answers, analyze your grammar missteps, and <strong className="text-rose-300 font-medium">replay them</strong> until perfectly fixed.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
