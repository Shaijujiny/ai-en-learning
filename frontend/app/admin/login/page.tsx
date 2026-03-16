"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { readApiData } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await readApiData<{ access_token: string }>(response);
      window.localStorage.setItem("token", data.access_token);
      router.push("/admin");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to log in.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,185,141,0.12),transparent_28%),linear-gradient(180deg,#160d07_0%,#120c0a_50%,#090808_100%)] px-5 py-6 text-white md:px-8 md:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-orange-200/15 bg-[linear-gradient(180deg,rgba(80,46,20,0.55),rgba(30,18,12,0.9))] p-8 shadow-[0_28px_80px_rgba(35,19,9,0.45)] md:p-10">
            <p className="text-xs uppercase tracking-[0.34em] text-orange-200/80">
              Admin Access
            </p>
            <h1 className="display mt-4 text-5xl font-semibold text-white">
              Restricted access only.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-orange-50/80">
              If you are a normal user, use the regular account flow instead of
              this route.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                className="rounded-full border border-orange-200/20 bg-white/5 px-4 py-2 text-sm text-orange-50"
                href="/register"
              >
                Go to signup
              </Link>
              <Link
                className="rounded-full border border-orange-200/20 bg-white/5 px-4 py-2 text-sm text-orange-50"
                href="/login"
              >
                User login
              </Link>
            </div>
          </div>

          <form
            className="rounded-[2rem] border border-orange-200/15 bg-[linear-gradient(180deg,rgba(42,27,18,0.75),rgba(20,13,11,0.94))] p-8 shadow-[0_28px_80px_rgba(35,19,9,0.45)]"
            onSubmit={handleSubmit}
          >
            <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">
              Platform control
            </p>
            <div className="mt-6 space-y-4">
              <input
                className="w-full rounded-[1.25rem] border border-orange-200/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-orange-200/35"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Admin email"
                type="email"
                value={email}
              />
              <input
                className="w-full rounded-[1.25rem] border border-orange-200/10 bg-black/25 px-4 py-3 text-white outline-none transition focus:border-orange-200/35"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
              <button
                className="w-full rounded-[1.3rem] bg-[linear-gradient(135deg,#ffb98d_0%,#ffd6a5_100%)] px-4 py-3 font-medium text-slate-950 disabled:opacity-50"
                disabled={loading || !email || !password}
                type="submit"
              >
                {loading ? "Signing in..." : "Enter admin portal"}
              </button>
            </div>
            {error ? (
              <p className="mt-4 rounded-[1.25rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
