"use client";

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { MouseEvent, ReactNode, useCallback } from "react";

export function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);
  const background = useMotionTemplate`radial-gradient(360px circle at ${mx}px ${my}px, rgba(103,232,249,0.05), transparent 60%)`;

  const onMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }, [mx, my]);

  const onLeave = useCallback(() => { mx.set(-200); my.set(-200); }, [mx, my]);

  return (
    <motion.div onMouseMove={onMove} onMouseLeave={onLeave} className={`group relative overflow-hidden ${className}`}>
      <motion.div aria-hidden style={{ background }} className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {children}
    </motion.div>
  );
}
