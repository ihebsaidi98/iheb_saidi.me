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

    // use device pixel ratio with an upper cap to avoid excessive supersampling
    const debug = typeof window !== "undefined" && window.location.search.includes("globe-debug");

    // default (recommended) config — tuned for dark card background
    const cfg = {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: width * 1.5,
      height: width * 1.5,
      phi: 0,
      theta: 0.28,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 8,
      baseColor: [0.32, 0.45, 0.55],
      markerColor: [0.43, 0.94, 0.68],
      glowColor: [0.16, 0.45, 0.5],
      markers: [{ location: [36.8065, 10.1815], size: 0.09 }],
    } as unknown as COBEOptions;

    if (debug) console.log("COBE globe debug config", cfg);

    // onRender handler
    const onRender = (state: { phi: number; width: number; height: number }) => {
        if (pointerInteracting.current === null && !reduceMotion) {
          phi += 0.003;
        }
        state.phi = phi + pointerInteractionMovement.current;
        state.width = width * 1.5;
        state.height = width * 1.5;
      };

    // debug wrapper for createGlobe to expose the canvas and GL context in the running app
    const createGlobeDebug = (...args: any[]) => {
      const inst = (createGlobe as any)(...args);
      try {
        const canvas = args[0] as HTMLCanvasElement | null;
        const opts = args[1];
        if (canvas) {
          const gl = (canvas.getContext("webgl") || canvas.getContext("webgl2")) as WebGLRenderingContext | null;
          try {
            (window as any).__inAppCobe = (window as any).__inAppCobe || {};
            (window as any).__inAppCobe.canvas = canvas;
            (window as any).__inAppCobe.gl = gl;
            (window as any).__inAppCobe.opts = opts;
            (window as any).__inAppCobe.createdAt = Date.now();
            // helper to sample pixels from the app canvas
            (window as any).__inAppCobe.sample = function(){
              try{
                const g = (canvas.getContext('webgl') || canvas.getContext('webgl2')) as WebGLRenderingContext | null;
                if(!g) return null;
                const px = new Uint8Array(4);
                g.readPixels(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
                return Array.from(px);
              }catch(e){ return null; }
            };
          } catch (e) {}
        }
      } catch (e) {}
      return inst;
    };

    // create globe once with onRender included
    const globeWithRender = createGlobeDebug(canvasRef.current, { ...cfg, onRender, context: { preserveDrawingBuffer: true } } as unknown as COBEOptions);
    (globeWithRender as any).__debug = { cfg };
    if (debug) {
      try {
        (window as any).__lastCobeCfg = cfg;
        (window as any).__lastCobe = globeWithRender;
      } catch (e) {}
    }

    const onResize = () => {
      width = canvasRef.current?.offsetWidth ?? width;
    };

    const observer = new ResizeObserver(onResize);
    if (wrapRef.current) observer.observe(wrapRef.current);

    return () => {
      globeWithRender.destroy();
      observer.disconnect();
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