"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Politeness = "polite" | "assertive";

export interface AnnounceOptions {
  politeness?: Politeness;
  timeout?: number;
}

interface AnnouncerContextValue {
  announce: (message: string, options?: AnnounceOptions) => void;
  message: string;
  politeness: Politeness;
}

const AnnouncerContext = createContext<AnnouncerContextValue>({
  announce: () => {},
  message: "",
  politeness: "polite",
});

export function useAnnouncer() {
  return useContext(AnnouncerContext);
}

export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [politeness, setPoliteness] = useState<Politeness>("polite");

  const announce = useCallback((newMessage: string, options?: AnnounceOptions) => {
    setPoliteness(options?.politeness ?? "polite");
    // Clear first to ensure screen readers detect repeated identical messages
    setMessage("");
    requestAnimationFrame(() => {
      setMessage(newMessage);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <AnnouncerContext.Provider value={{ announce, message, politeness }}>
      {children}
      <Announcer message={message} politeness={politeness} />
    </AnnouncerContext.Provider>
  );
}

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
