"use client";

import { useSyncExternalStore } from "react";

export type Environment = {
  webgl: boolean;
  mobile: boolean;
  lowPower: boolean;
  reduceMotion: boolean;
};

const SERVER_ENV: Environment = {
  webgl: false,
  mobile: false,
  lowPower: false,
  reduceMotion: false,
};

let webglCapable: boolean | null = null;

function probeWebGL(): boolean {
  if (webglCapable !== null) return webglCapable;
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;

    const ctx =
      (canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) as WebGLRenderingContext | null);

    webglCapable = ctx !== null;

    if (ctx) {
      const ext =
        (ctx as WebGL2RenderingContext).getExtension?.("WEBGL_lose_context") ??
        (ctx as WebGLRenderingContext).getExtension?.("WEBGL_lose_context");
      ext?.loseContext();
    }

    canvas.width = 0;
    canvas.height = 0;
  } catch {
    webglCapable = false;
  }

  return webglCapable;
}

let cached: Environment | null = null;

function detect(): Environment {
  if (cached) return cached;

  const webgl = probeWebGL();

  const mobile =
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;

  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;

  cached = {
    webgl,
    mobile,
    lowPower:
      (navigator.hardwareConcurrency ?? 8) <= 4 ||
      conn?.saveData === true ||
      conn?.effectiveType === "2g" ||
      conn?.effectiveType === "slow-2g",
    reduceMotion:
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).has("a11y"),
  };

  return cached;
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const mqs = [
    "(max-width: 768px)",
    "(pointer: coarse)",
    "(prefers-reduced-motion: reduce)",
  ].map((q) => window.matchMedia(q));

  const handleChange = () => {
    cached = null; // force re-detect
    onChange();
  };

  mqs.forEach((mq) => mq.addEventListener("change", handleChange));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", handleChange));
}

export function useEnvironment(): Environment {
  return useSyncExternalStore(subscribe, detect, () => SERVER_ENV);
}