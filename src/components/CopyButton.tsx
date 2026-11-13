"use client";

import React, { useEffect, useState } from "react";
import { Announcer } from "@/components/ui/Announcer";

export function CopyButton({
  value,
  children = "copy",
  successText = "copied ✓",
}: {
  value: string;
  children?: React.ReactNode;
  successText?: string;
}) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (status === "idle") return;

    const timeout = window.setTimeout(() => {
      setStatus("idle");
      setAnnouncement("");
    }, status === "error" ? 2200 : 1600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setStatus("success");
        setAnnouncement("Copied to clipboard");
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      // Fallback for browsers / environments where navigator.clipboard throws
      try {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (successful) {
          setStatus("success");
          setAnnouncement("Copied to clipboard");
          return;
        }
      } catch {
        // Fallback failed
      }
      setStatus("error");
      setAnnouncement("Failed to copy to clipboard");
    }
  };

  const accessibleLabel =
    status === "success"
      ? "Copied to clipboard"
      : status === "error"
        ? "Failed to copy to clipboard"
        : typeof children === "string"
          ? `${children}: copy ${value}`
          : `Copy ${value}`;

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={accessibleLabel}
        className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] surface.subtle px-2.5 py-1.5 font-mono text-2xs tracking-[0.18em] text-text-secondary transition-colors duration-300 hover:border-white/[0.14] hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <span>
          {status === "success"
            ? successText
            : status === "error"
              ? "copy failed"
              : children}
        </span>
      </button>
      <Announcer message={announcement} politeness="polite" />
    </>
  );
}
