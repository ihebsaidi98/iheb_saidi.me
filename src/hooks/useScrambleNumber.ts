"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function useScrambleNumber(target: number, duration = 900, trigger = 0) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(String(target));

  useEffect(() => {
    if (reducedMotion) {
      setValue(String(target));
      return;
    }

    const chars = "0123456789";
    const finalValue = String(target);
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const settledLength = Math.max(1, Math.round(progress * finalValue.length));

      const nextValue = Array.from({ length: finalValue.length }, (_, index) => {
        if (index < settledLength) return finalValue[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join("");

      setValue(nextValue);

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, reducedMotion, target, trigger]);

  return { ref, value };
}
