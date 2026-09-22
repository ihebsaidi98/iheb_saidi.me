"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import type { AboutSkill } from "@/data/about";

const SEGMENTS = 12;

export function SignalMeter({
  name,
  level,
  note,
  delay,
}: AboutSkill & { delay: number }) {
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion === null ? false : reducedMotion;
  const filled = Math.round((level / 100) * SEGMENTS);

  return (
    <motion.div
      initial={shouldReduce ? false : { opacity: 0, y: 12 }}
      whileInView={shouldReduce ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={
        shouldReduce ? { duration: 0 } : { duration: 0.45, ease: EASE, delay }
      }
      whileHover={shouldReduce ? undefined : { x: 4 }}
      className="group"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-white/70 transition-transform duration-300 group-hover:translate-x-1">
          {name}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-white/30 transition-colors group-hover:text-emerald-200/80">
          {level}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={`${name}: ${level} percent`}
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 flex items-center gap-[2px]"
      >
        {Array.from({ length: SEGMENTS }).map((_, index) => (
          <motion.span
            key={`${name}-${index}`}
            initial={shouldReduce ? false : { opacity: 0, scaleY: 0.2 }}
            whileInView={shouldReduce ? { opacity: 1, scaleY: 1 } : { opacity: 1, scaleY: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={
              shouldReduce
                ? { duration: 0 }
                : { duration: 0.35, ease: EASE, delay: delay + index * 0.03 }
            }
            className={`h-1 flex-1 rounded-[1px] transition-colors duration-300 ${
              index < filled
                ? "bg-gradient-to-r from-emerald-300/80 to-cyan-400/60 group-hover:from-emerald-300 group-hover:to-cyan-300/80"
                : "bg-white/[0.08] group-hover:bg-white/[0.12]"
            }`}
          />
        ))}
      </div>

      {note && (
        <div className="mt-1.5 font-mono text-[9px] tracking-wider text-white/0 transition-colors duration-300 group-hover:text-white/30">
          {note}
        </div>
      )}
    </motion.div>
  );
}
