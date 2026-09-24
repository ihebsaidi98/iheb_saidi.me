"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import { profile } from "@/data/profile";
import { useTilt } from "@/hooks/useTilt";

export function IdentityCard() {
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion === null ? false : reducedMotion;
  const tilt = useTilt({ max: 6 });

  return (
    <motion.div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      initial={shouldReduce ? false : { opacity: 0, y: 24 }}
      whileInView={shouldReduce ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={shouldReduce ? { duration: 0 } : { duration: 0.7, ease: EASE }}
      style={
        shouldReduce
          ? undefined
          : {
              transform: `perspective(1200px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
            }
      }
      className="group/card relative h-fit overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] transition-colors duration-500 hover:border-emerald-300/20 will-change-transform"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-emerald-300/[0.07] via-transparent to-cyan-400/[0.05] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
      />

      {!shouldReduce && (
        <motion.div
          aria-hidden
          style={{
            background: `radial-gradient(340px circle at ${tilt.glowX}% ${tilt.glowY}%, rgba(52, 211, 153, 0.1), transparent 70%)`,
          }}
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
        />
      )}

      <div className="relative m-3 overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#0b1210] to-[#070d0c]">
        {/* soft glow behind the cutout */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-6 rounded-full bg-emerald-400/[0.08] blur-2xl"
        />

        <div className="relative aspect-square">
          <Image
            src={profile.portrait}
            alt={`${profile.name}, ${profile.title}`}
            fill
            sizes="(min-width: 1200px) 316px, calc(100vw - 48px)"
            className="object-contain drop-shadow-[0_10px_30px_rgba(16,185,129,0.15)] transition-transform duration-700 ease-out group-hover/card:scale-[1.02]"
          />

          {!shouldReduce && (
            <motion.div
              aria-hidden
              initial={{ top: "-8%" }}
              whileInView={{ top: "108%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
              className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
            />
          )}

          <div aria-hidden className="pointer-events-none absolute inset-3">
            <span className="absolute left-0 top-0 size-3 border-l border-t border-emerald-300/60" />
            <span className="absolute right-0 top-0 size-3 border-r border-t border-emerald-300/60" />
            <span className="absolute bottom-0 left-0 size-3 border-b border-l border-emerald-300/60" />
            <span className="absolute bottom-0 right-0 size-3 border-b border-r border-emerald-300/60" />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 font-mono text-[9px] tracking-[0.2em] text-white/50">
            <span>PORTRAIT — {profile.portraitYear}</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-7 pt-3 sm:px-6">
        <div className="font-serif text-xl text-white">{profile.name}</div>
        <div className="mt-0.5 font-mono text-[10px] tracking-wider text-white/40">
          {profile.title}
        </div>
      </div>
    </motion.div>
  );
}