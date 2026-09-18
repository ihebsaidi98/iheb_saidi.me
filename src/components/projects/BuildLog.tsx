"use client";

import { motion } from "framer-motion";

import type { Project } from "@/data/projects";

/* =========================================================
   Reuses the same tokens as SelectedWorkPanels so the two
   sections read as one system — but the PATTERN here is
   opposite on purpose: flat rows, not a focused panel;
   many-at-once, not one-at-a-time; scanned, not browsed.
   ========================================================= */

const TOKENS = {
  paper: "#EEF0EA",
  panel: "#F7F8F3",
  ink: "#14181B",
  line: "#C9CDC2",
  signal: "#B5551F",
  measure: "#1F6E63",
} as const;

const CATEGORY_COLOR: Record<Project["category"], string> = {
  backend: TOKENS.measure,
  fullstack: TOKENS.ink,
  ai: TOKENS.signal,
};

const CATEGORY_LABEL: Record<Project["category"], string> = {
  backend: "Backend",
  fullstack: "Full-stack",
  ai: "AI",
};

function BuildRow({ project, index }: { project: Project; index: number }) {
  const href = project.links?.demo ?? project.links?.github;

  const cells = (
    <div className="grid grid-cols-[20px_1fr_auto] items-center gap-4 py-4 sm:grid-cols-[20px_1.4fr_1fr_90px_70px] sm:gap-6">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: CATEGORY_COLOR[project.category] }}
      />

      <div className="min-w-0">
        <p className="truncate text-[15px]" style={{ color: TOKENS.ink }}>
          {project.title}
        </p>
        <p className="mt-0.5 text-[12px] sm:hidden" style={{ color: `${TOKENS.ink}66` }}>
          {project.organization} · {CATEGORY_LABEL[project.category]}
        </p>
      </div>

      <p
        className="hidden truncate text-[13px] sm:block"
        style={{ color: `${TOKENS.ink}80` }}
      >
        {project.tech.slice(0, 4).join(", ")}
      </p>

      <p
        className="hidden font-mono text-[11px] tabular-nums sm:block"
        style={{ color: `${TOKENS.ink}66` }}
      >
        {project.period}
      </p>

      <div className="text-right font-mono text-[12px]">
        {href ? (
          <span style={{ color: TOKENS.measure }}>[ open ]</span>
        ) : (
          <span style={{ color: `${TOKENS.ink}33` }}>[ — ]</span>
        )}
      </div>
    </div>
  );

  return (
    <li
      className="group relative border-b transition-colors duration-150"
      style={{ borderColor: TOKENS.line }}
    >
      {/* accent tick — appears on hover/focus, log-diff style */}
      <span
        aria-hidden
        className="absolute -left-4 top-0 h-full w-[2px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ backgroundColor: CATEGORY_COLOR[project.category] }}
      />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${project.title} — view project`}
          className="block outline-none transition-colors duration-150 group-hover:bg-[var(--row-hover)]"
          style={{ ["--row-hover" as string]: TOKENS.panel }}
        >
          {cells}
        </a>
      ) : (
        cells
      )}
    </li>
  );
}

type BuildLogProps = {
  projects: readonly Project[];
};

export default function BuildLog({ projects }: BuildLogProps) {
  if (projects.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-15% 0px" }}
      transition={{ duration: 0.5 }}
      className="mt-16 sm:mt-20"
      style={{ backgroundColor: TOKENS.paper }}
    >
      <div
        className="flex items-baseline justify-between border-b pb-3"
        style={{ borderColor: TOKENS.ink }}
      >
        <h2
          className="font-mono text-xl font-medium tracking-[-0.01em] sm:text-2xl"
          style={{ color: TOKENS.ink }}
        >
          More builds
        </h2>
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: `${TOKENS.ink}66` }}
        >
          {projects.length} logged
        </span>
      </div>

      {/* column headers — desktop only */}
      <div
        className="hidden grid-cols-[20px_1.4fr_1fr_90px_70px] gap-6 pb-2 pt-3 text-[11px] sm:grid"
        style={{ color: `${TOKENS.ink}55` }}
      >
        <span />
        <span>Project</span>
        <span>Stack</span>
        <span>Shipped</span>
        <span />
      </div>

      <ul className="pl-4 sm:pl-4">
        {projects.map((project, index) => (
          <BuildRow key={project.slug} project={project} index={index} />
        ))}
      </ul>
    </motion.div>
  );
}