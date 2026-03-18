"use client";

import { AssessmentStatusBanner } from "@/components/AssessmentStatusBanner";
import { ReactNode } from "react";

export function AppShell(props: { children: ReactNode }) {
  return (
    <>
      <AssessmentStatusBanner />
      {props.children}
    </>
  );
}

