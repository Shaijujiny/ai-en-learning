"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readApiData } from "@/lib/api";

type MeResponse = {
  assessment_status: string;
  user_level?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function shouldHideBanner(pathname: string) {
  if (!pathname) return false;
  if (pathname.startsWith("/admin")) return true;
  if (pathname === "/login") return true;
  if (pathname === "/register") return true;
  if (pathname.startsWith("/assessment")) return true;
  return false;
}

export function AssessmentStatusBanner() {
  const pathname = usePathname();
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("token") ?? "";
    setToken(storedToken);

    function onStorage(event: StorageEvent) {
      if (event.key === "token") {
        setToken(event.newValue ?? "");
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<MeResponse>(response);
        if (!cancelled) setStatus(data.assessment_status);
      } catch {
        if (!cancelled) setStatus(null);
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (shouldHideBanner(pathname)) return null;
  if (!token) return null;
  if (!status) return null;
  if (status === "completed") return null;

  const message =
    status === "pending"
      ? "Onboarding assessment is not completed. Finish it to unlock a personalized level, coaching, and recommendations."
      : "Onboarding assessment was skipped. Complete it to unlock a personalized level, coaching, and recommendations.";

  return (
    <div className="sticky top-0 z-50 border-b border-amber-300/20 bg-[rgba(12,20,35,0.88)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,0.12)]" />
          <p className="text-sm leading-6 text-slate-200">{message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="min-h-[44px] rounded-full bg-[linear-gradient(135deg,#fbbf24_0%,#f97316_100%)] px-4 py-2 text-center text-sm font-semibold text-slate-950 transition-all duration-200 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
            href="/assessment"
          >
            Complete assessment
          </Link>
        </div>
      </div>
    </div>
  );
}

