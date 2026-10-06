"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type SectionTitle = string | [string, string];

export function SectionHeader({
  label,
  title,
  intro,
  headingId,
}: {
  label: string;
  title: SectionTitle;
  intro?: string;
  headingId: string;
}) {
  const reducedMotion = useReducedMotion();
  const titleLines = typeof title === "string" ? [title] : title;

  return (
    <motion.header
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative z-10 max-w-3xl"
    >
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="pointer-events-none h-px w-6 bg-[#6ee7b7]" />
        <div data-role="label" className="font-mono text-[12px] lowercase tracking-[0.14em] text-[#6ee7b7]">
          {label}
        </div>
      </div>

      <h2
        id={headingId}
        className="font-display text-balance text-[clamp(1.875rem,4.5vw,3rem)] leading-[1.1] tracking-tight text-white"
      >
        {titleLines.map((line, index) => (
          <span
            key={`${headingId}-${index}`}
            data-role={index === 0 ? "title-line-1" : "title-line-2"}
            className={`block ${index === 1 ? "text-[#6ee7b7]" : "text-white"}`}
          >
            {line}
          </span>
        ))}
      </h2>

      {intro ? (
        <p data-role="intro" className="mt-5 max-w-[56ch] text-base leading-6 text-white/60 md:text-[17px] md:leading-[1.65]">
          {intro}
        </p>
      ) : null}
    </motion.header>
  );
}

export function SectionShell({
  id,
  label,
  title,
  intro,
  children,
  className = "",
}: {
  id: string;
  label: string;
  title: SectionTitle;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={headingId} className={`relative py-24 md:py-32 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 md:px-10">
        <SectionHeader label={label} title={title} intro={intro} headingId={headingId} />
        <div className="mt-12 md:mt-16">{children}</div>
      </div>
    </section>
  );
}