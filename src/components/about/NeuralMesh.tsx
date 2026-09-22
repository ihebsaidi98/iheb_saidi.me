"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

export function NeuralMesh({
  hostRef,
  className,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion === null ? false : reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mobileMatch = window.matchMedia("(min-width: 768px)");
    let nodeDensity = mobileMatch.matches ? 26 : 16;
    const pointer = { x: -9999, y: -9999 };
    const nodes: Array<{ x: number; y: number; vx: number; vy: number }> = [];
    const pulses: Array<{ a: number; b: number; t: number; s: number }> = [];
    let raf = 0;
    let isActive = false;

    const buildNodes = () => {
      nodes.length = 0;
      for (let index = 0; index < nodeDensity; index += 1) {
        nodes.push({
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.0007,
          vy: (Math.random() - 0.5) * 0.0007,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);

      ctx.clearRect(0, 0, width, height);

      const points = nodes.map((node) => ({ x: node.x * width, y: node.y * height }));

      for (let index = 0; index < nodes.length; index += 1) {
        for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
          const current = points[index];
          const next = points[nextIndex];
          const distance = Math.hypot(current.x - next.x, current.y - next.y);

          if (distance < 160) {
            ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - distance / 160) * 0.12})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(current.x, current.y);
            ctx.lineTo(next.x, next.y);
            ctx.stroke();
          }
        }
      }

      for (const point of points) {
        const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
        if (distance < 150) {
          ctx.strokeStyle = `rgba(103, 232, 249, ${(1 - distance / 150) * 0.22})`;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      for (const point of points) {
        ctx.fillStyle = "rgba(167, 243, 208, 0.4)";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const pulse of pulses) {
        const start = points[pulse.a];
        const end = points[pulse.b];
        if (!start || !end || pulse.t >= 1) continue;

        ctx.fillStyle = "rgba(103, 232, 249, 0.65)";
        ctx.beginPath();
        ctx.arc(
          start.x + (end.x - start.x) * pulse.t,
          start.y + (end.y - start.y) * pulse.t,
          1.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    };

    const step = () => {
      for (const node of nodes) {
        node.x = Math.min(1, Math.max(0, node.x + node.vx));
        node.y = Math.min(1, Math.max(0, node.y + node.vy));

        if (node.x <= 0 || node.x >= 1) {
          node.vx *= -1;
        }
        if (node.y <= 0 || node.y >= 1) {
          node.vy *= -1;
        }
      }

      for (let index = pulses.length - 1; index >= 0; index -= 1) {
        pulses[index].t += pulses[index].s;
        if (pulses[index].t >= 1) {
          pulses.splice(index, 1);
        }
      }

      if (Math.random() < 0.04) {
        const first = Math.floor(Math.random() * nodeDensity);
        const second = Math.floor(Math.random() * nodeDensity);
        if (first !== second) {
          pulses.push({ a: first, b: second, t: 0, s: 0.008 + Math.random() * 0.016 });
        }
      }

      draw();
      raf = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (isActive || shouldReduce) return;
      isActive = true;
      raf = window.requestAnimationFrame(step);
    };

    const stop = () => {
      isActive = false;
      window.cancelAnimationFrame(raf);
    };

    const updateDensity = () => {
      const nextDensity = mobileMatch.matches ? 26 : 16;
      if (nextDensity !== nodeDensity) {
        nodeDensity = nextDensity;
        buildNodes();
      }
      draw();
    };

    const handleMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    };

    const handleLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false;
        if (isVisible) {
          start();
          return;
        }
        stop();
      },
      { rootMargin: "200px" },
    );

    buildNodes();
    resize();

    if (shouldReduce) {
      draw();
    } else {
      observer.observe(host);
      host.addEventListener("pointermove", handleMove);
      host.addEventListener("pointerleave", handleLeave);
      start();
    }

    mobileMatch.addEventListener("change", updateDensity);

    return () => {
      stop();
      observer.disconnect();
      host.removeEventListener("pointermove", handleMove);
      host.removeEventListener("pointerleave", handleLeave);
      mobileMatch.removeEventListener("change", updateDensity);
    };
  }, [hostRef, shouldReduce]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
