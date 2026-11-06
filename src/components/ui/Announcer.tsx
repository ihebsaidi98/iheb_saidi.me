"use client";

import React from "react";

export type Politeness = "polite" | "assertive";


export interface AnnouncerProps {
  message?: string;
  politeness?: Politeness;
  className?: string;
}

export function Announcer({
  message = "",
  politeness = "polite",
  className = "sr-only",
}: AnnouncerProps) {
  return (
    <div
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      aria-atomic="true"
      className={className}
    >
      {message}
    </div>
  );
}
