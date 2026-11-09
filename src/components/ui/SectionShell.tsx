"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type SectionTitle = string | [string, string];

const titleRevealWrapperVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const titleLineVariants = {
  hidden: { y: "100%" },
  show: {
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

function renderTitleLine(line: string) {
  if (!line.endsWith(".")) {
    return <>{line}</>;
  }

  return (
    <>
      {line.slice(0, -1)}
      <span className="text-emerald-300">.</span>
    </>
  );
}

export function SectionHeader({
  label,
  title,
  intro,
  headingId,
  as = "h2",
}: {
  label: string;
  title: SectionTitle;
  intro?: string;
  headingId: string;
  as?: "h2" | "h3";
}) {
  const titleLines = typeof title === "string" ? [title] : title;
  const HeadingComponent = as === "h3" ? motion.h3 : motion.h2;

  return (
    <motion.header
      // NOTE: do NOT branch initial/whileInView on useReducedMotion() here.
      // SSR sees false, a reduced-motion client sees true on first render,
      // producing different serialized styles → React hydration error #418.
      // The root MotionConfig reducedMotion="user" already makes framer
      // instant-finish these reveals for reduced-motion users.
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative z-10 max-w-3xl"
    >
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="pointer-events-none h-px w-6 bg-emerald-300" />
        <div data-role="label" className="font-mono text-[12px] lowercase tracking-[0.14em] text-emerald-300">
          {label}
        </div>
      </div>

      <HeadingComponent
        id={headingId}
        // See the hydration note above: keep initial deterministic across
        // server and client; MotionConfig reducedMotion handles the rest.
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={titleRevealWrapperVariants}
        className="relative block font-display text-balance text-[clamp(1.875rem,4.5vw,3rem)] leading-[1.1] tracking-tight text-white"
      >
        {titleLines.map((line, index) => (
          <span
            key={`${headingId}-${index}`}
            data-role={index === 0 ? "title-line-1" : "title-line-2"}
            className="block overflow-hidden"
          >
            <motion.span
              variants={titleLineVariants}
              className={`block pb-[0.12em] ${index === 1 ? "text-emerald-300" : "text-white"}`}
            >
              {renderTitleLine(line)}
            </motion.span>
          </span>
        ))}
      </HeadingComponent>

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
  as = "h2",
}: {
  id: string;
  label: string;
  title: SectionTitle;
  intro?: string;
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  const headingId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={headingId} className={`relative py-24 md:py-32 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 md:px-10">
        <SectionHeader label={label} title={title} intro={intro} headingId={headingId} as={as} />
        <div className="mt-12 md:mt-16">{children}</div>
      </div>
    </section>
  );
}