"use client";

import { useCallback, useEffect, useRef } from "react";
import createGlobe, { type COBEOptions } from "cobe";
import { useInView, useReducedMotion } from "framer-motion";

export function Globe() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  // Start building the globe slightly before it scrolls into view
  const inView = useInView(wrapRef, { margin: "250px", once: true });
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointerInteracting.current = event.clientX - pointerInteractionMovement.current;
    },
    [],
  );
  const stopPointerInteraction = useCallback(() => {
    pointerInteracting.current = null;
  }, []);
  const updatePointerInteraction = useCallback((clientX: number) => {
    if (pointerInteracting.current === null) return;
    pointerInteractionMovement.current = (clientX - pointerInteracting.current) / 200;
  }, []);
  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      updatePointerInteraction(event.clientX);
    },
    [updatePointerInteraction],
  );
  const onTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length > 0) updatePointerInteraction(event.touches[0].clientX);
    },
    [updatePointerInteraction],
  );

  useEffect(() => {
    if (!inView || !canvasRef.current) return;

    let width = canvasRef.current.offsetWidth;
    let phi = 0;

    // dpr 1.5 + buffer 1.5 — was effectively 4x supersampled before
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 1.5,
      width: width * 1.5,
      height: width * 1.5,
      phi: 0,
      theta: 0.28,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.05, 0.15, 0.2],
      markerColor: [0.43, 0.94, 0.68],
      glowColor: [0.15, 0.4, 0.45],
      markers: [{ location: [36.8065, 10.1815], size: 0.09 }],
      onRender: (state: { phi: number; width: number; height: number }) => {
        if (pointerInteracting.current === null && !reduceMotion) {
          phi += 0.003;
        }
        state.phi = phi + pointerInteractionMovement.current;
        state.width = width * 1.5;
        state.height = width * 1.5;
      },
    } as unknown as COBEOptions);

    const onResize = () => {
      width = canvasRef.current?.offsetWidth ?? width;
    };
    window.addEventListener("resize", onResize);

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [inView, reduceMotion]);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-square w-full max-w-[280px] cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerUp={stopPointerInteraction}
      onPointerOut={stopPointerInteraction}
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
    >
      {/* Loading state until cobe initializes */}
      {!inView && (
        <div
          aria-hidden
          className="absolute inset-[30%] animate-pulse rounded-full bg-emerald-300/[.07] blur-2xl"
        />
      )}
      <canvas ref={canvasRef} className="aspect-square size-full contain-layout paint-contain" />
    </div>
  );
}