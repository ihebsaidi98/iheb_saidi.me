"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import { useCountUp } from "@/hooks/useCountUp";

export function StatTile({
  value,
  suffix,
  label,
  index,
}: {
  value: number;
  suffix?: string;
  label: string;
  index: number;
}) {
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion === null ? false : reducedMotion;
  const { ref, value: displayed } = useCountUp(value, shouldReduce ? 0 : 1200);

  return (
    <motion.div
      initial={shouldReduce ? false : { opacity: 0, y: 16 }}
      whileInView={shouldReduce ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={
        shouldReduce
          ? { duration: 0 }
          : { duration: 0.6, ease: EASE, delay: index * 0.08 }
      }
      whileHover={shouldReduce ? undefined : { y: -2, borderColor: "rgba(110,231,183,0.28)" }}
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.25)] sm:p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-emerald-400/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative font-serif text-xl tracking-[-0.04em] text-white sm:text-2xl md:text-3xl">
        <span ref={ref} className="tabular-nums">
          {displayed}
          {suffix}
        </span>
      </div>
      <div className="relative mt-1.5 text-[10px] leading-4 text-white/35 sm:text-[11px]">
        {label}
      </div>
    </motion.div>
  );
}
