"use client";

import { EASE, FADE_UP_DURATION } from "@/components/hero-motion";
import { skillGroups } from "@/data/skills";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useCallback, useState } from "react";

type SkillGroup = (typeof skillGroups)[number];

function DomainNode({ group, index, active, onActivate }: { group: SkillGroup; index: number; active: boolean; onActivate: (label: string | null) => void }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-.5, .5], [2.5, -2.5]), { stiffness: 140, damping: 22 });
  const rotateY = useSpring(useTransform(pointerX, [-.5, .5], [-3, 3]), { stiffness: 140, damping: 22 });
  const onMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - .5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - .5);
  }, [pointerX, pointerY, reduceMotion]);
  const reset = useCallback(() => { pointerX.set(0); pointerY.set(0); onActivate(null); }, [onActivate, pointerX, pointerY]);
  const label = group.label === "DevOps/QA" ? "Delivery / DevOps" : group.label;

  return <motion.article initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: FADE_UP_DURATION, delay: index * .07, ease: EASE }} onPointerEnter={() => onActivate(group.label)} onPointerMove={onMove} onPointerLeave={reset} style={reduceMotion ? undefined : { rotateX, rotateY }} className={`group relative w-full overflow-hidden rounded-xl border p-5 text-left [transform-style:preserve-3d] transition-[border-color,background-color,box-shadow,opacity] duration-300 ${active ? "border-emerald-200/40 bg-emerald-300/[.055] shadow-[0_16px_40px_rgba(110,231,183,.08)]" : "border-white/[.08] bg-white/[.025] hover:border-white/[.16] hover:bg-white/[.04]"}`}>
    <span aria-hidden className={`absolute left-0 top-5 h-7 w-px bg-gradient-to-b from-emerald-200 to-sky-300 transition-opacity duration-300 ${active ? "opacity-100" : "opacity-30"}`} />
    <span className="font-mono text-[9px] tracking-[.16em] text-white/35">0{index + 1} / DOMAIN</span>
    <h4 className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[.14em] text-white/80 transition-colors group-hover:text-emerald-100">{label}</h4>
    <ul className="mt-4 space-y-1.5 text-left text-xs leading-5 text-white/50">{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
    <span aria-hidden className={`absolute bottom-3 right-3 size-1.5 rounded-full transition-all duration-300 ${active ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" : "bg-white/15"}`} />
  </motion.article>;
}

function Core({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  return <motion.div initial={{ opacity: 0, scale: .92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .7, ease: EASE }} className="relative mx-auto grid aspect-square w-full max-w-[300px] place-items-center [perspective:900px]">
    <div aria-hidden className="absolute inset-[10%] rounded-full bg-emerald-300/[.07] blur-3xl" />
    <motion.div animate={reduceMotion ? undefined : { rotate: 360 }} transition={{ duration: 32, repeat: Infinity, ease: "linear" }} className="absolute inset-[10%] rounded-[2rem] border border-dashed border-cyan-200/15" />
    <motion.div animate={reduceMotion ? undefined : { rotate: -360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }} className="absolute inset-[20%] rounded-full border border-emerald-200/20" />
    <motion.div animate={reduceMotion ? undefined : { y: [0, -5, 0], scale: active ? [1, 1.045, 1] : 1 }} transition={{ duration: active ? 1.4 : 4.8, repeat: Infinity, ease: "easeInOut" }} className={`engineering-grid relative grid size-32 place-items-center rounded-2xl border bg-[#0a0f14] shadow-[0_24px_70px_rgba(0,0,0,.42)] transition-colors duration-300 ${active ? "border-emerald-200/55" : "border-white/15"}`}>
      <span aria-hidden className={`absolute inset-3 rounded-xl border transition-colors duration-300 ${active ? "border-emerald-300/35" : "border-white/10"}`} />
      <span className="relative text-center font-mono text-[10px] font-semibold tracking-[.16em] text-emerald-100">ENGINEERING<br />CORE</span>
    </motion.div>
    <p className="absolute -bottom-3 font-mono text-[9px] tracking-[.16em] text-white/35">SYSTEM / 03</p>
  </motion.div>;
}

export function EngineeringToolkit() {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const left = [skillGroups[0], skillGroups[2], skillGroups[3]];
  const right = [skillGroups[1], skillGroups[4], skillGroups[5]];
  return <div id="stack" className="relative mt-20 overflow-hidden py-4"><div aria-hidden className="engineering-grid pointer-events-none absolute inset-x-0 top-20 h-[75%] opacity-45 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" /><div className="relative"><motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ duration: FADE_UP_DURATION, ease: EASE }} className="max-w-2xl"><p className="eyebrow">03 — ENGINEERING TOOLKIT</p><div className="section-line" /><h3 className="mt-6 font-serif text-3xl tracking-[-.03em] sm:text-4xl">Engineering Toolkit</h3><p className="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">A connected toolkit for designing, delivering, and maintaining reliable software systems.</p></motion.div><div className="relative mt-12 lg:mt-16"><svg aria-hidden viewBox="0 0 1000 620" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"><g fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1"><path d="M 310 120 C 410 140, 420 250, 500 310" /><path d="M 310 310 C 390 310, 420 310, 500 310" /><path d="M 310 500 C 410 470, 420 370, 500 310" /><path d="M 690 120 C 590 140, 580 250, 500 310" /><path d="M 690 310 C 610 310, 580 310, 500 310" /><path d="M 690 500 C 590 470, 580 370, 500 310" /></g>{activeDomain && <g fill="none" stroke="rgba(110,231,183,.55)" strokeWidth="1.5"><path d="M 310 310 C 390 310, 420 310, 500 310" /><path d="M 690 310 C 610 310, 580 310, 500 310" /></g>}</svg><div className="relative grid gap-5 lg:grid-cols-[1fr_.9fr_1fr] lg:items-center lg:gap-10"><div className="order-2 grid gap-4 lg:order-1">{left.map((group, index) => <DomainNode key={group.label} group={group} index={index} active={activeDomain === group.label} onActivate={setActiveDomain} />)}</div><div className="order-1 lg:order-2"><Core active={activeDomain !== null} /></div><div className="order-3 grid gap-4">{right.map((group, index) => <DomainNode key={group.label} group={group} index={index + 3} active={activeDomain === group.label} onActivate={setActiveDomain} />)}</div></div></div></div></div>;
}
