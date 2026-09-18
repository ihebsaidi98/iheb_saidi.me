"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useCallback, useState } from "react";

type ProjectVisualProps = { filename: string; title: string };

export function ProjectVisual({ filename, title }: ProjectVisualProps) {
  const [missing, setMissing] = useState(false);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-.5, .5], [2.5, -2.5]), { stiffness: 120, damping: 22 });
  const rotateY = useSpring(useTransform(pointerX, [-.5, .5], [-2.5, 2.5]), { stiffness: 120, damping: 22 });
  const imageX = useSpring(useTransform(pointerX, [-.5, .5], [-5, 5]), { stiffness: 120, damping: 22 });
  const imageY = useSpring(useTransform(pointerY, [-.5, .5], [-4, 4]), { stiffness: 120, damping: 22 });
  const onMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - .5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - .5);
  }, [pointerX, pointerY, reduceMotion]);
  const onLeave = useCallback(() => { pointerX.set(0); pointerY.set(0); }, [pointerX, pointerY]);

  if (missing) return <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-white/15 bg-white/[.02] p-6 text-center text-sm text-white/45">Screenshot coming soon<br /><span className="mt-2 text-xs text-white/30">public/images/{filename}</span></div>;
  return <motion.div initial={{ opacity: 0, y: 24, scale: 1.06 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .7, ease: [0.16, 1, .3, 1] }} onPointerMove={onMove} onPointerLeave={onLeave} className="relative min-h-56 [perspective:1000px]"><div aria-hidden className="absolute inset-x-5 bottom-0 top-6 rounded-2xl bg-gradient-to-r from-emerald-300/[.10] via-transparent to-sky-300/[.10] blur-2xl" /><motion.div style={reduceMotion ? undefined : { rotateX, rotateY }} className="group relative min-h-56 overflow-hidden rounded-xl border border-white/10 bg-[#070a0d] shadow-[0_16px_45px_rgba(0,0,0,.25)] transition-[border-color,box-shadow] duration-300 hover:border-white/20 hover:shadow-[0_22px_55px_rgba(0,0,0,.36)]"><div aria-hidden className="absolute inset-x-0 top-0 z-20 flex h-8 items-center gap-1.5 border-b border-white/[.07] bg-[#0a0f14]/90 px-3 backdrop-blur"><i className="size-1.5 rounded-full bg-white/15" /><i className="size-1.5 rounded-full bg-white/15" /><i className="size-1.5 rounded-full bg-white/15" /><span className="ml-3 h-3 flex-1 rounded-full bg-white/[.045]" /></div><motion.div style={reduceMotion ? undefined : { x: imageX, y: imageY }} className="absolute -inset-2"><Image src={`/images/${filename}`} alt={`${title} product screenshot`} fill sizes="(max-width: 767px) 100vw, (max-width: 1199px) 90vw, 62vw" className="object-cover opacity-90 transition-transform duration-500 ease-out group-hover:scale-[1.025]" onError={() => setMissing(true)} /></motion.div><div aria-hidden className="absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-[#05070a]/25 to-transparent" /><motion.div aria-hidden initial={{ scaleX: 1 }} whileInView={{ scaleX: 0 }} viewport={{ once: true }} transition={{ duration: .75, ease: [0.16, 1, .3, 1], delay: .1 }} className="absolute inset-0 z-30 origin-right bg-[#05070a]" /></motion.div></motion.div>;
}
