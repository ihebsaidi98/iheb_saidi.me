"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";

export function MotionEnhancements() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const scaleX = useSpring(scrollYProgress, {
    stiffness: reduceMotion ? 1000 : 180,
    damping: reduceMotion ? 100 : 32,
    mass: reduceMotion ? 0.1 : 0.35,
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]"
    >
      <motion.div
        className="absolute inset-0 origin-left bg-emerald-300/15 blur-[5px]"
        style={{ scaleX }}
      />

      <motion.div
        className="absolute inset-y-0 left-0 origin-left bg-gradient-to-r from-emerald-300 via-emerald-200 to-sky-400"
        style={{ scaleX }}
      />
    </div>
  );
}