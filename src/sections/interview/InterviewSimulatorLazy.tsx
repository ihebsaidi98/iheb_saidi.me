/**
 * src/components/interview/InterviewSimulatorLazy.tsx
 *
 * Client Component wrapper for ADR-04 code-splitting of InterviewSimulatorSection.
 * Allows `ssr: false` in App Router while rendering an accessible skeleton on the server.
 */

"use client";

import React from "react";
import dynamic from "next/dynamic";
import { SectionShell } from "@/components/ui/SectionShell";

export function InterviewSimulatorSkeleton() {
  return (
    <SectionShell
      id="interview"
      label="interactive"
      title={["Technical Interview", "Simulator."]}
      intro="Test your full-stack, backend, frontend, or AI engineering knowledge with real production interview questions."
    >
      <div className="mx-auto max-w-4xl min-h-[560px] rounded-2xl border border-border-default bg-surface-card p-8 animate-pulse" />
    </SectionShell>
  );
}

const DynamicInterviewSimulator = dynamic(
  () =>
    import("@/sections/InterviewSimulator").then(
      (mod) => mod.InterviewSimulatorSection
    ),
  {
    ssr: false,
    loading: () => <InterviewSimulatorSkeleton />,
  }
);

export function InterviewSimulatorLazy() {
  return <DynamicInterviewSimulator />;
}
