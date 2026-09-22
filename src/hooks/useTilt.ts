"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

export function useTilt({ max = 6 }: { max?: number } = {}) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const reset = useCallback(() => {
    setRotation({ x: 0, y: 0 });
    setGlow({ x: 50, y: 50 });
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reducedMotion || !ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      setRotation({
        x: (0.5 - py) * max * 2,
        y: (px - 0.5) * max * 2,
      });

      setGlow({
        x: px * 100,
        y: py * 100,
      });
    },
    [max, reducedMotion],
  );

  return {
    ref,
    rotateX: rotation.x,
    rotateY: rotation.y,
    glowX: glow.x,
    glowY: glow.y,
    onPointerMove,
    onPointerLeave: reset,
  };
}
