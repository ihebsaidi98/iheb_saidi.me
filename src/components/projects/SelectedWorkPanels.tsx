"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import type { Project } from "@/data/projects";

/* =========================================================
   TOKENS — scoped to this section only (see note in chat:
   this is a deliberate departure from the site's dark/glass
   system, not an attempt to blend in with it).
   ========================================================= */

const TOKENS = {
  paper: "#EEF0EA",
  panel: "#F7F8F3",
  ink: "#14181B",
  line: "#C9CDC2",
  signal: "#B5551F", // one live/primary number per panel
  measure: "#1F6E63", // links, interactive state
} as const;

const PANEL_HEIGHT = 560; // fixed — every panel occupies the same footprint

function getScreenshotSrc(screenshot: string) {
  return screenshot.startsWith("/") ? screenshot : `/images/${screenshot}`;
}

/* =========================================================
   CORNER BRACKETS — drafting-plan crop marks instead of a
   rounded card border. A structural device, not decoration:
   it frames "this is the instrument currently being read."
   ========================================================= */

function CornerBrackets() {
  const size = 16;
  const corners = [
    { top: 0, left: 0, borderWidth: "2px 0 0 2px" },
    { top: 0, right: 0, borderWidth: "2px 2px 0 0" },
    { bottom: 0, left: 0, borderWidth: "0 0 2px 2px" },
    { bottom: 0, right: 0, borderWidth: "0 2px 2px 0" },
  ] as const;
  return (
    <>
      {corners.map((corner, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            width: size,
            height: size,
            borderColor: TOKENS.ink,
            borderStyle: "solid",
            ...corner,
          }}
        />
      ))}
    </>
  );
}

/* =========================================================
   RULER — horizontal tick strip that replaces dot indicators.
   Doubles as the position readout ("panel n of total").
   ========================================================= */

function Ruler({
  total,
  active,
  onSelect,
}: {
  total: number;
  active: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      className="mb-8 flex items-stretch"
      style={{ borderBottom: `1px solid ${TOKENS.line}` }}
      role="tablist"
      aria-label="Select project"
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === active;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Project ${index + 1} of ${total}`}
            onClick={() => onSelect(index)}
            className="group relative flex-1 pb-3 pt-1 text-left"
          >
            <span
              className="mb-2 block transition-all duration-200"
              style={{
                height: isActive ? 10 : 6,
                width: 1,
                backgroundColor: isActive ? TOKENS.ink : TOKENS.line,
                marginLeft: index === 0 ? 0 : undefined,
              }}
            />
            <span
              className="font-mono text-[11px] tabular-nums transition-colors duration-200"
              style={{ color: isActive ? TOKENS.ink : `${TOKENS.ink}66` }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================
   PANEL — the reading for one project.
   ========================================================= */

function Panel({ project }: { project: Project }) {
  return (
    <div className="flex h-full flex-col gap-6 p-6 sm:p-8 lg:p-10 lg:pt-9">
      {/* meta row */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm" style={{ color: `${TOKENS.ink}99` }}>
          {project.role} at {project.organization}
        </p>
        <p
          className="font-mono text-[11px] tabular-nums"
          style={{ color: `${TOKENS.ink}66` }}
        >
          {project.period}
        </p>
      </div>

      {/* title */}
      <h3
        className="font-mono text-[26px] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[32px] lg:text-[36px]"
        style={{ color: TOKENS.ink }}
      >
        {project.title}
      </h3>

      {/* viewport + readout */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_220px]">
        <div
          className="img-zoom relative aspect-[16/10] overflow-hidden"
          style={{ backgroundColor: TOKENS.ink, border: `1px solid ${TOKENS.line}` }}
        >
          <Image
            src={getScreenshotSrc(project.screenshot)}
            alt={`${project.title} screenshot`}
            fill
            sizes="(max-width: 1024px) 100vw, 620px"
            className="object-cover object-top opacity-95"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: `inset 0 0 0 1px ${TOKENS.paper}22`,
            }}
          />
        </div>

        {/* metrics readout */}
        <div className="flex flex-col justify-center gap-4 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
          style={{ borderColor: TOKENS.line }}
        >
          {project.metrics && project.metrics.length > 0 ? (
            project.metrics.slice(0, 4).map((metric, i) => (
              <div key={metric.label}>
                <div
                  className="font-mono text-xl tabular-nums"
                  style={{ color: i === 0 ? TOKENS.signal : TOKENS.ink }}
                >
                  {metric.value}
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: `${TOKENS.ink}66` }}>
                  {metric.label}
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px]" style={{ color: `${TOKENS.ink}55` }}>
              No published metrics for this build.
            </p>
          )}
        </div>
      </div>

      {/* description */}
      <p
        className="line-clamp-2 max-w-[65ch] text-[15px] leading-6"
        style={{ color: `${TOKENS.ink}b3` }}
      >
        {project.description}
      </p>

      {/* footer */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 border-t pt-4"
        style={{ borderColor: TOKENS.line }}
      >
        <p className="text-[13px]" style={{ color: `${TOKENS.ink}80` }}>
          {project.tech.slice(0, 6).join(" / ")}
        </p>

        <div className="flex items-center gap-3 font-mono text-[12px]">
          {project.links?.demo && (
            <a
              href={project.links.demo}
              target="_blank"
              rel="noreferrer"
              style={{ color: TOKENS.measure }}
              className="transition-opacity hover:opacity-70"
            >
              [ live ]
            </a>
          )}
          {project.links?.github && (
            <a
              href={project.links.github}
              target="_blank"
              rel="noreferrer"
              style={{ color: `${TOKENS.ink}99` }}
              className="transition-opacity hover:opacity-70"
            >
              [ source ]
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION
   ========================================================= */

type SelectedWorkPanelsProps = {
  projects: readonly Project[];
};

export default function SelectedWorkPanels({ projects }: SelectedWorkPanelsProps) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive((current) => Math.min(current, projects.length - 1));
  }, [projects.length]);

  if (projects.length === 0) return null;

  const canPrev = active > 0;
  const canNext = active < projects.length - 1;
  const prev = () => canPrev && setActive((i) => i - 1);
  const next = () => canNext && setActive((i) => i + 1);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" && canPrev) {
      event.preventDefault();
      prev();
    } else if (event.key === "ArrowRight" && canNext) {
      event.preventDefault();
      next();
    }
  };

  const project = projects[active];

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative rounded-none p-6 outline-none sm:p-10"
      style={{ backgroundColor: TOKENS.paper }}
    >
      <Ruler total={projects.length} active={active} onSelect={setActive} />

      <div
        className="relative"
        style={{ height: PANEL_HEIGHT, backgroundColor: TOKENS.panel }}
      >
        <CornerBrackets />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={project.slug}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            <Panel project={project} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* nav */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={!canPrev}
            aria-label="Previous project"
            className="flex h-9 w-9 items-center justify-center font-mono text-sm transition-opacity disabled:opacity-25"
            style={{ border: `1px solid ${TOKENS.ink}`, color: TOKENS.ink }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            aria-label="Next project"
            className="flex h-9 w-9 items-center justify-center font-mono text-sm transition-opacity disabled:opacity-25"
            style={{ border: `1px solid ${TOKENS.ink}`, color: TOKENS.ink }}
          >
            ›
          </button>
        </div>

        <p
          className="font-mono text-[11px] tabular-nums"
          style={{ color: `${TOKENS.ink}80` }}
          aria-live="polite"
        >
          {String(active + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}