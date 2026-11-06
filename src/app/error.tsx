"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#04070c] px-6 text-white">
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-xs text-red-300/80">$ npm run production</p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Something threw.</h1>
        <p className="mt-4 font-mono text-sm text-white/50">
          Unhandled exception — not on my résumé, but here we are.
        </p>
        <button
          onClick={reset}
          className="mt-8 rounded-full border border-emerald-200/25 bg-emerald-300/[0.08] px-6 py-3 text-xs font-semibold transition-colors hover:bg-emerald-300/[0.14]"
        >
          $ git reset --hard && retry
        </button>
      </div>
    </main>
  );
}