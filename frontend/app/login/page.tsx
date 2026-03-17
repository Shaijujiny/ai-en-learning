"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { readApiData } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
      setError(`⚠️ Too many attempts. Try again in ${remainingMinutes} minutes.`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setAttempts((prev) => prev + 1);
        if (attempts + 1 >= 3) {
          const lockoutTime = Date.now() + 5 * 60 * 1000;
          setLockoutUntil(lockoutTime);
          throw new Error("⚠️ Too many attempts. Try again in 5 minutes");
        }
      }

      const data = await readApiData<{
        access_token: string;
        refresh_token?: string;
        next_route: string;
      }>(response);

      setAttempts(0);
      setLockoutUntil(null);
      window.localStorage.setItem("token", data.access_token);
      if (data.refresh_token) {
        window.localStorage.setItem("refresh_token", data.refresh_token);
      }
      // Set cookie so middleware can protect routes server-side
      const maxAge = 60 * 60 * 24 * 7; // 7 days
      document.cookie = `auth_token=${data.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next || data.next_route || "/portal");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to log in.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell grid-overlay min-h-screen px-4 py-6 text-slate-100 md:px-8 flex items-center justify-center relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <section className="w-full max-w-5xl z-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel rounded-[2.5rem] p-8 md:p-12 border border-white/5 bg-slate-950/60 backdrop-blur-xl shadow-2xl flex flex-col justify-center">
            <div className="inline-block px-3 py-1 mb-6 rounded-full border border-cyan-400/20 bg-cyan-500/10 w-max">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-medium text-cyan-300">
                Welcome Back
                </p>
            </div>
            <h1 className="display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1]">
              Resume your <br/><span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#69e2ff,#a7f3d0)]">English journey.</span>
            </h1>
            <p className="mt-6 text-base lg:text-lg text-slate-400 leading-relaxed font-light">
              Sign in to continue practicing with our advanced AI avatars. Dive back into Interview Mode or start a new Real Life scenario right where you left off.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                className="rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-6 py-3 text-sm font-medium text-slate-200 transition shadow-sm"
                href="/register"
              >
                Create new account
              </Link>
              <Link
                className="rounded-full border border-transparent px-6 py-3 text-sm font-medium text-slate-400 hover:text-white transition"
                href="/"
              >
                ← Back home
              </Link>
            </div>
          </div>

          <form className="glass-panel rounded-[2.5rem] p-8 md:p-12 border border-white/5 bg-slate-950/60 backdrop-blur-xl shadow-2xl flex flex-col justify-center" onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold text-white mb-2">Account Login</h2>
            <p className="text-sm text-slate-400 mb-8">Enter your credentials to securely access your portal.</p>
            
            <div className="space-y-4">
              <div>
                  <input
                    className="w-full rounded-[1.25rem] border border-white/10 bg-slate-900/80 px-5 py-4 text-white outline-none transition focus:border-cyan-400/50 focus:bg-slate-900 focus:shadow-[0_0_15px_rgba(34,211,238,0.1)] placeholder:text-slate-500"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email address"
                    type="email"
                    value={email}
                  />
              </div>
              <div>
                  <input
                    className="w-full rounded-[1.25rem] border border-white/10 bg-slate-900/80 px-5 py-4 text-white outline-none transition focus:border-cyan-400/50 focus:bg-slate-900 focus:shadow-[0_0_15px_rgba(34,211,238,0.1)] placeholder:text-slate-500"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    type="password"
                    value={password}
                  />
              </div>
              <button
                className="w-full rounded-[1.25rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-5 py-4 font-bold text-slate-950 shadow-[0_4px_14px_rgba(105,226,255,0.3)] transition hover:shadow-[0_6px_20px_rgba(105,226,255,0.4)] disabled:opacity-50 disabled:shadow-none mt-2 text-sm sm:text-base"
                disabled={loading || !email || !password}
                type="submit"
              >
                {loading ? "Authenticating..." : "Sign In →"}
              </button>
            </div>
            
            {error ? (
              <div className="mt-6 rounded-[1rem] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200 flex items-center gap-3">
                <span className="text-rose-400 text-lg">⚠️</span>
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
