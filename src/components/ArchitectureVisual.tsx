"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useCallback } from "react";

const nodes = ["API", "EVENT", "DATA"];

export function ArchitectureVisual() {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [4, -4]), { stiffness: 90, damping: 20 });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-5, 5]), { stiffness: 90, damping: 20 });
  const onMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  }, [pointerX, pointerY, reduceMotion]);
  const reset = useCallback(() => { pointerX.set(0); pointerY.set(0); }, [pointerX, pointerY]);

  return <div onPointerMove={onMove} onPointerLeave={reset} className="relative mx-auto aspect-square w-full max-w-[430px] [perspective:900px]">
    <div aria-hidden className="absolute inset-[12%] rounded-full bg-emerald-300/[.07] blur-3xl" />
    <motion.div style={reduceMotion ? undefined : { rotateX, rotateY }} animate={reduceMotion ? undefined : { y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="engineering-grid surface absolute inset-[8%] rounded-[2rem] shadow-[0_24px_70px_rgba(0,0,0,.35)] [transform-style:preserve-3d]">
      <div aria-hidden className="absolute inset-8 rounded-full border border-cyan-300/10" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[-28deg] bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[34deg] bg-gradient-to-r from-transparent via-sky-300/35 to-transparent" />
      <motion.div animate={reduceMotion ? undefined : { scale: [1, 1.035, 1], boxShadow: ["0 0 34px rgba(110,231,183,.12)", "0 0 54px rgba(110,231,183,.24)", "0 0 34px rgba(110,231,183,.12)"] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }} className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-emerald-200/35 bg-[#0a0f14] [transform:translateZ(34px)]"><span className="text-center font-mono text-[10px] font-semibold tracking-[.15em] text-emerald-200">SERVICE<br />CORE</span></motion.div>
      {nodes.map((node, index) => <motion.div key={node} animate={reduceMotion ? undefined : { y: [0, index === 1 ? -3 : 3, 0] }} transition={{ duration: 3 + index, repeat: Infinity, ease: "easeInOut", delay: index * .4 }} className={`absolute grid size-14 place-items-center rounded-xl border border-white/10 bg-[#0a0f14]/95 font-mono text-[9px] tracking-[.12em] text-white/65 shadow-xl ${index === 0 ? "right-[12%] top-[17%]" : index === 1 ? "bottom-[13%] left-[18%]" : "bottom-[15%] right-[14%]"}`}><span>{node}</span></motion.div>)}
      <div className="absolute left-[15%] top-[19%] size-9 rounded-full border border-cyan-300/30 bg-cyan-300/[.06]" />
      {!reduceMotion && <><i aria-hidden className="data-particle absolute left-[22%] top-[43%] hidden size-1.5 rounded-full bg-emerald-200 shadow-[0_0_10px_rgba(110,231,183,.9)] sm:block" /><i aria-hidden className="data-particle absolute right-[32%] top-[55%] hidden size-1.5 rounded-full bg-sky-200 shadow-[0_0_10px_rgba(56,189,248,.8)] [animation-delay:-1.8s] sm:block" /></>}
    </motion.div>
  </div>;
}
