"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

export function SignalRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.offsetWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const r = size * 0.42;
    let raf = 0;
    let angle = 0;

    const blips = [
      { a: 0.6, d: 0.55 },
      { a: 2.4, d: 0.8 },
      { a: 4.1, d: 0.35 },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // rings
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cx, (r * i) / 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(110, 231, 183, 0.12)";
        ctx.stroke();
      }
      // crosshair
      ctx.strokeStyle = "rgba(110, 231, 183, 0.08)";
      ctx.beginPath();
      ctx.moveTo(cx - r, cx); ctx.lineTo(cx + r, cx);
      ctx.moveTo(cx, cx - r); ctx.lineTo(cx, cx + r);
      ctx.stroke();

      // sweep
      const grad = ctx.createConicGradient
        ? ctx.createConicGradient(angle, cx, cx) : null;
      if (grad) {
        grad.addColorStop(0, "rgba(110, 231, 183, 0.25)");
        grad.addColorStop(0.15, "rgba(110, 231, 183, 0)");
        grad.addColorStop(1, "rgba(110, 231, 183, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cx);
        ctx.arc(cx, cx, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // blips
      for (const b of blips) {
        const bx = cx + Math.cos(b.a) * r * b.d;
        const by = cx + Math.sin(b.a) * r * b.d;
        ctx.fillStyle = "rgba(103, 232, 249, 0.8)";
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // center
      ctx.fillStyle = "rgba(110, 231, 183, 0.9)";
      ctx.beginPath();
      ctx.arc(cx, cx, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    if (reducedMotion) {
      draw();
      return;
    }

    const step = () => {
      angle += 0.015;
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="aspect-square w-full max-w-[280px]"
    />
  );
}