"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(window.localStorage.getItem("token") ?? "");
  }, []);

  return (
    <main className="app-shell grid-overlay min-h-screen px-5 py-6 text-slate-100 md:px-8 md:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col justify-center gap-6">
        <div className="glass-panel rounded-[2rem] p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.36em] text-cyan-300">
            AI Interview Platform
          </p>
          <h1 className="display mt-4 max-w-4xl text-5xl font-semibold text-white md:text-7xl">
            Practice with AI in a focused user portal.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
            Log in, register, and start conversations from a dedicated user
            workspace with scenarios, custom prompts, voice, and analytics.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel rounded-[2rem] p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
              User Portal
            </p>
            <h2 className="display mt-4 text-4xl font-semibold text-white">
              Practice conversations
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Start from built-in scenarios or build a custom conversation with
              your own prompt instructions after login.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-3 text-sm font-medium text-slate-950"
                href={token ? "/portal" : "/login"}
              >
                {token ? "Open user portal" : "User login"}
              </Link>
              <Link
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                href="/register"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Start Here
            </p>
            <h2 className="display mt-4 text-4xl font-semibold text-white">
              Create your account first.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Registration and login are separated from the scenario screen. After
              authentication, the app takes you into the portal to choose a
              scenario or build a custom conversation prompt.
            </p>
            <div className="mt-8 space-y-3 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm text-slate-300">
                1. Register an account
              </p>
              <p className="text-sm text-slate-300">
                2. Log in
              </p>
              <p className="text-sm text-slate-300">
                3. Open the user portal and start practicing
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
