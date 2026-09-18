"use client";

import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Fragment, useRef } from "react";

const words = [
  "Java",
  "Spring Boot",
  "Angular",
  "TypeScript",
  "Microservices",
  "PostgreSQL",
  "Docker",
  "AI",
  "CQRS",
];

const wrap = (value: number) => `${((value % 25) + 25) % 25 - 25}%`;

export const TapeSection = () => {
  const reducedMotion = useReducedMotion();
  const baseX = useMotionValue(0);
  const x = useTransform(baseX, wrap);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0 });

  // Only advances while the tape is actually on screen
  useAnimationFrame((_, delta) => {
    if (!reducedMotion && inView) baseX.set(baseX.get() - delta / 450);
  });

  return (
    <section
      aria-label="Engineering values"
      className="overflow-hidden border-y border-white/[.06] bg-white/[.015] py-3"
    >
      <div ref={ref}>
        <motion.div
          style={{ x: reducedMotion ? "0%" : x }}
          className="flex w-max gap-5 pr-5"
        >
          {[0, 1, 2].map((copy) => (
            <Fragment key={copy}>
              {words.map((word) => (
                <span
                  key={`${copy}-${word}`}
                  className="inline-flex items-center gap-5 whitespace-nowrap text-[10px] font-medium uppercase tracking-[.16em] text-white/40"
                >
                  <i aria-hidden className="size-1 rounded-full bg-emerald-300/70" />
                  {word}
                </span>
              ))}
            </Fragment>
          ))}
        </motion.div>
      </div>
    </section>
  );
};