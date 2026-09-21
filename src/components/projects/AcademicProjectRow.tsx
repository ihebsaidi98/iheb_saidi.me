"use client";

import Image from "next/image";
import type { AcademicProject } from "@/data/projects";

/* =========================================================
   ACADEMIC PROJECT ROW — editorial list item, not a card.
   ---------------------------------------------------------
   Typography-driven row: oversized index, serif title that
   shifts a few pixels on hover/focus, mono metadata, and a
   large image that is visually "set back" by default and
   expands to full bleed on hover via a clip-path transition.

   Interactions are pure CSS (clip-path + transform only):
   no cursor tracking, no JS hover state, no re-renders.
   All transitions are gated behind `motion-safe` so reduced-
   motion users get fully static, fully readable content.

   Mobile: rows stack vertically, image sits below the text
   and is always fully visible (clip removed below lg).
   ========================================================= */

const pad2 = (n: number) => String(n + 1).padStart(2, "0");
const MAX_TECH = 6;

const rowClass =
  "group block border-t border-white/[0.07] py-10 transition-colors duration-300 " +
  "hover:bg-white/[0.015] focus-visible:bg-white/[0.015] sm:py-12 lg:py-14";

function RowBody({ project, index }: { project: AcademicProject; index: number }) {
  const tech = project.tech.slice(0, MAX_TECH);

  return (
    <div className="lg:flex lg:items-center lg:gap-12">
      {/* -------- text column -------- */}
      <div className="flex min-w-0 flex-1 items-start gap-5 sm:gap-8">
        <span
          aria-hidden
          className="pt-1.5 font-serif text-lg tabular-nums text-white/20 transition-all duration-500 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:text-emerald-200/70 sm:text-xl"
        >
          {pad2(index)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-serif text-2xl leading-tight tracking-[-0.02em] text-white/85 transition-transform duration-500 ease-out motion-safe:group-hover:translate-x-2 sm:text-3xl lg:text-4xl">
              {project.title}
            </h3>
            {/* desktop arrow — inline in the text column so the
                row never depends on hover alone for affordance */}
            <span
              aria-hidden
              className="mt-1.5 hidden shrink-0 font-mono text-sm text-white/25 transition-all duration-300 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:text-emerald-200/80 lg:block"
            >
              ↗
            </span>
          </div>

          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            {project.organization}&nbsp;&nbsp;·&nbsp;&nbsp;{project.period}
          </p>

          <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
            {project.description}
          </p>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-200/45 transition-colors duration-300 group-hover:text-emerald-200/65">
            {tech.join(" · ")}
            {project.tech.length > MAX_TECH && " · …"}
          </p>
        </div>
      </div>

      {/* -------- image — editorial reveal -------- */}
      <div className="relative mt-7 shrink-0 lg:mt-0 lg:w-[40%]">
        <div
          className={
            "relative aspect-[16/10] overflow-hidden rounded-xl border border-white/[0.08] " +
            "bg-[#0a0f16] " +
            "lg:[clip-path:inset(10%_5%_10%_5%_round_12px)] " +
            "lg:transition-[clip-path] lg:duration-500 lg:ease-out " +
            "motion-safe:lg:group-hover:[clip-path:inset(0_0_0_0_round_12px)]"
          }
        >
          <Image
            src={`/images/${project.screenshot}`}
            alt={`${project.title} — project screenshot`}
            fill
            sizes="(max-width: 1023px) 100vw, 40vw"
            className="object-cover object-top motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-[1.04]"
          />
        </div>
      </div>
    </div>
  );
}

export function AcademicProjectRow({
  project,
  index,
}: {
  project: AcademicProject;
  index: number;
}) {
  return (
    <li>
      {project.link ? (
        <a
          href={project.link}
          target="_blank"
          rel="noreferrer"
          aria-label={`${project.title} — view project`}
          className={rowClass}
        >
          <RowBody project={project} index={index} />
        </a>
      ) : (
        /* No fabricated links: rows without a URL render as plain
           articles with identical styling — no dead affordance. */
        <article aria-label={project.title} className={rowClass}>
          <RowBody project={project} index={index} />
        </article>
      )}
    </li>
  );
}