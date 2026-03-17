"use client";

import { ReactNode } from "react";
import { AssessmentStatusBanner } from "@/components/AssessmentStatusBanner";

export function AppShell(props: { children: ReactNode }) {
  return (
    <>
      <AssessmentStatusBanner />
      {props.children}
    </>
  );
}

