"use client";

import { ReactNode } from "react";
import { AssessmentStatusBanner } from "@/components/AssessmentStatusBanner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppShell(props: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AssessmentStatusBanner />
      {/* Floating theme toggle — visible on every page */}
      <div className="theme-toggle-wrapper">
        <ThemeToggle />
      </div>
      {props.children}
    </ThemeProvider>
  );
}
