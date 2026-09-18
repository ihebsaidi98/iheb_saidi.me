"use client";

import { useLocalTime } from "@/hooks/useLocalTime";

export function Footer() {
  const time = useLocalTime();

  return (
    <footer className="border-t border-white/[0.07] py-8">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 font-mono text-[10px] tracking-[0.15em] text-white/25 sm:flex-row">
        <span>© 2026 IHEB SAIDI</span>
        <span className="tabular-nums">TUNIS, TN — {time}</span>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="px-2 py-2 tracking-[0.2em] transition-colors hover:text-white/60"
        >
          BACK TO TOP ↑
        </button>
      </div>
    </footer>
  );
}