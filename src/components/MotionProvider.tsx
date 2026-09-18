"use client";

import { domMax, LazyMotion, MotionConfig } from "framer-motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict={false}>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}