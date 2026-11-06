"use client";

import { useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import { ReactNode, useEffect } from "react";

export function normalizeInitialHash(pathname: string, hash: string | null | undefined): string {
  if (!pathname || pathname === "/") {
    return "";
  }

  return hash ?? "";
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const normalizedHash = normalizeInitialHash(pathname, hash);

    if (normalizedHash !== hash) {
      const nextUrl = `${pathname}${window.location.search}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    // native scrolling on touch devices and for reduced-motion users
    if (reduceMotion || window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true,
      autoRaf: false,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [reduceMotion]);

  return <>{children}</>;
}