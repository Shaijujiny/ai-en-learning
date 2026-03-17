"use client";

import { useRouter } from "next/navigation";

export function BackButton(props: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  const label = props.label ?? "Back";

  return (
    <button
      className="min-h-[44px] rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-all duration-200 ease-out hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
      type="button"
      onClick={() => {
        // Prefer browser back when available; fallback keeps navigation reliable.
        try {
          router.back();
          // If there is no history entry, Next may stay on the same page.
          // The fallback below ensures the button always does something useful.
          window.setTimeout(() => {
            if (window.history.length <= 1) {
              router.push(props.fallbackHref);
            }
          }, 0);
        } catch {
          router.push(props.fallbackHref);
        }
      }}
    >
      {label}
    </button>
  );
}

