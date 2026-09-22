"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import { CopyButton } from "@/components/CopyButton";
import { profile } from "@/data/profile";
import { useLocalTime } from "@/hooks/useLocalTime";
import { useTilt } from "@/hooks/useTilt";

const Globe = dynamic(
  () => import("@/components/Globe").then((module) => module.Globe),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="aspect-square w-full max-w-[260px] animate-pulse rounded-full bg-emerald-300/[.05] blur-2xl"
      />
    ),
  },
);

export function IdentityCard() {
  const reducedMotion = useReducedMotion();
  const shouldReduce = reducedMotion === null ? false : reducedMotion;
  const time = useLocalTime(profile.timezone);
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

      <div className="relative m-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#070b0a]">
        <div className="relative aspect-square">
          <Image
            src={profile.portrait}
            alt={`${profile.name}, ${profile.title}`}
            fill
            sizes="(min-width: 1024px) 316px, calc(100vw - 48px)"
            className="object-contain transition-transform duration-700 ease-out group-hover/card:scale-[1.02]"
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

          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 font-mono text-[9px] tracking-[0.2em] text-white/50">
            <span>PORTRAIT — {profile.portraitYear}</span>
            <span className="hidden text-emerald-200/60 sm:inline">{profile.coordinates}</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 pt-2 sm:px-6">
        <div className="font-serif text-xl text-white">{profile.name}</div>
        <div className="mt-0.5 font-mono text-[10px] tracking-wider text-white/40">
          {profile.title}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[9px] tracking-[0.18em] text-emerald-200/70">
            OPEN TO WORK
          </span>
        </div>

        <dl className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-5 font-mono text-[11px]">
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-white/30">location</dt>
            <dd className="truncate text-white/60">{profile.location}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-white/30">local_time</dt>
            <dd className="tabular-nums text-white/60">{time}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-white/30">email</dt>
            <dd className="min-w-0" aria-live="polite">
              <CopyButton value={profile.email}>copy</CopyButton>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-white/30">timezone</dt>
            <dd className="text-white/60">{profile.timezone}</dd>
          </div>
        </dl>

        <div className="relative mt-6 flex justify-center">
          <motion.div
            aria-hidden
            animate={shouldReduce ? undefined : { rotate: 360 }}
            transition={
              shouldReduce
                ? undefined
                : { repeat: Number.POSITIVE_INFINITY, duration: 40, ease: "linear" }
            }
            className="absolute inset-[-14%]"
          >
            <svg viewBox="0 0 100 100" className="h-full w-full" fill="none">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="0.6"
                strokeDasharray="1.5 4.5"
              />
            </svg>
          </motion.div>
          <div className="relative z-10">
            <Globe />
          </div>
        </div>
        <p className="relative mt-2 text-center font-mono text-[9px] tracking-[0.2em] text-white/24">
          {profile.coordinates}
        </p>
      </div>
    </motion.div>
  );
}
