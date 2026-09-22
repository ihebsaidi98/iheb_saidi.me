"use client";

import { useEffect, useState } from "react";

export function CopyButton({
  value,
  children,
  successText = "copied ✓",
}: {
  value: string;
  children: React.ReactNode;
  successText?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op fallback: the button still communicates the action state.
    }
    setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-white/70 transition-colors duration-300 hover:border-white/[0.14] hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
    >
      <span>{copied ? successText : children}</span>
    </button>
  );
}
