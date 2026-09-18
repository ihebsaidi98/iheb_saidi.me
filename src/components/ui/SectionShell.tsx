"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "@/components/hero-motion";

export function SectionShell({
  id,
  index,
  eyebrow,
  title,
  intro,
  children,
  className = "",
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative py-24 sm:py-32 ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
        }}
      />
      <div className="container relative mx-auto px-6">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="max-w-2xl"
        >
          <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.22em] text-emerald-200/70">
            <span className="text-white/25">{index}</span>
            <span className="h-px w-8 bg-emerald-300/40" />
            {eyebrow}
          </div>
          <h2 className="mt-4 font-serif text-4xl tracking-[-0.04em] text-white sm:text-5xl">
            {title}
          </h2>
          {intro && (
            <p className="mt-4 text-pretty text-base leading-7 text-white/50">
              {intro}
            </p>
          )}
        </motion.header>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  );
}