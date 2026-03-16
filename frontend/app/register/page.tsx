"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { readApiData } from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: fullName,
          password,
        }),
      });

      await readApiData<{
        user_id: number;
        email: string;
        assessment_status: string;
        next_route: string;
      }>(registerResponse);

      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await readApiData<{
        access_token: string;
        next_route: string;
      }>(loginResponse);
      window.localStorage.setItem("token", data.access_token);
      router.push(data.next_route || "/assessment");
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Unable to register.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell grid-overlay min-h-screen px-5 py-6 text-slate-100 md:px-8 md:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="glass-panel rounded-[2rem] p-8 md:p-10">
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-300">
              Registration
            </p>
            <h1 className="display mt-4 text-5xl font-semibold text-white">
              Create an account, then enter the user portal.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Registration is separate from scenario selection. After sign-up,
              the user is logged in and taken into a short English assessment
              before normal practice begins.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                href="/login"
              >
                Already have an account
              </Link>
            </div>
          </div>

          <form className="glass-panel rounded-[2rem] p-8" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Create access
            </p>
            <div className="mt-6 space-y-4">
              <input
                className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full name"
                value={fullName}
              />
              <input
                className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                type="email"
                value={email}
              />
              <input
                className="w-full rounded-[1.25rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
              <button
                className="w-full rounded-[1.3rem] bg-[linear-gradient(135deg,#69e2ff_0%,#a7f3d0_100%)] px-4 py-3 font-medium text-slate-950 disabled:opacity-50"
                disabled={loading || !fullName || !email || !password}
                type="submit"
              >
                {loading ? "Creating account..." : "Register"}
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
