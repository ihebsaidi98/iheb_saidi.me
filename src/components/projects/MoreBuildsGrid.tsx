"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from "framer-motion";

import ArrowUpRight from "@/assets/icons/arrow-up-right.svg";
import { CountUp } from "@/components/CountUp";
import type { Project } from "@/data/projects";

/* =========================================================
   BUILD INDEX — compact engineering ledger (Variant A)
   ---------------------------------------------------------
   The previous grid read as a smaller, weaker copy of the
   featured carousel: same card vocabulary, ~2x the height.
   This rebuild deliberately changes the pattern:

   - Cards shrink to a ~250px footprint (p-2, gap-3,
     aspect-[16/10] thumbs) so 8 builds scan in one glance
     and the featured work above stays cinematic.
   - Mono odometer indices + tabular year = a ledger readout,
     not marketing cards. Tags are capped at 2, 9px mono.
   - All motion is transform/opacity/filter only. The hover
     shadow is a pre-painted pseudo (opacity swap), never a
     box-shadow transition. Reduced-motion renders the final
     static state.
   ========================================================= */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const STAGGER = 0.055;

/* =========================================================
   HELPERS
   ========================================================= */

function getScreenshotSrc(screenshot: string) {
  return screenshot.startsWith("/") ? screenshot : `/images/${screenshot}`;
}

function yearOf(period: string) {
  const match = period.match(/\d{4}/);
  return match ? match[0] : "";
}

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

/* =========================================================
   ODOMETER INDEX — digits slide up through an overflow mask
   on first view, like a mechanical counter settling.
   ========================================================= */

function OdometerIndex({ index, delay }: { index: number; delay: number }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className="tabular-nums">{pad2(index)}</span>;
  }

  return (
    <span className="inline-block h-[11px] overflow-hidden" aria-hidden>
      <motion.span
        className="inline-block tabular-nums"
        initial={{ y: "115%" }}
        whileInView={{ y: "0%" }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, delay, ease: EASE }}
      >
        {pad2(index)}
      </motion.span>
    </span>
  );
}

/* =========================================================
   MAGNETIC ARROW — pulls ≤6px toward the cursor with tight
   springs (stiffness 300 / damping 22). Decorative.
   ========================================================= */

function MagneticArrow() {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 22, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 300, damping: 22, mass: 0.4 });

  const clamp6 = (v: number) => Math.max(-6, Math.min(6, v));

  return (
    <motion.span
      aria-hidden
      style={reduceMotion ? undefined : { x: sx, y: sy }}
      onPointerMove={(event) => {
        if (reduceMotion || event.pointerType !== "mouse") return;
        const r = event.currentTarget.getBoundingClientRect();
        x.set(clamp6((event.clientX - r.left - r.width / 2) * 0.4));
        y.set(clamp6((event.clientY - r.top - r.height / 2) * 0.4));
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="absolute right-1.5 top-1.5 z-10 grid size-6 cursor-pointer place-items-center rounded-md border border-white/10 bg-[#04070c]/75 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <ArrowUpRight className="size-3 text-emerald-200" />
    </motion.span>
  );
}

/* =========================================================
   CARD — whole card is ONE link; every decorative layer is
   aria-hidden. Height is fixed by the 16/10 thumb + clamps,
   so the grid has zero CLS regardless of copy length.
   ========================================================= */

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, delay: index * STAGGER, ease: EASE },
  }),
};

function BuildCard({ project, index }: { project: Project; index: number }) {
  const reduceMotion = useReducedMotion();
  const href = project.links?.demo ?? project.links?.github;

  const card = (
    <motion.article
      custom={index}
      variants={cardVariants}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-6% 0px" }}
      className="build-card surface relative overflow-hidden rounded-lg p-2 transition-[transform,border-color] duration-300 ease-out group-hover:-translate-y-[3px] group-hover:border-emerald-200/25 group-focus-within:-translate-y-[3px] group-focus-within:border-emerald-200/25"
    >
      {/* pre-painted hover shadow — opacity swap only, no
          box-shadow transition (paint-friendly) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 shadow-[0_12px_32px_rgba(0,0,0,.35)] transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
      />

      {/* idle shimmer: barely-visible top-edge emerald sweep,
          staggered ~9s per index. Desktop, motion-enabled only. */}
      {!reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-2 z-10 hidden h-px lg:block"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(110,231,183,.45), transparent)",
          }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{
            duration: 9,
            repeat: Infinity,
            delay: index * (9 / 8),
            ease: "easeInOut",
          }}
        />
      )}

      {/* thumbnail */}
      <div className="scan-thumb relative aspect-[16/10] overflow-hidden rounded-md border border-white/[0.06] bg-[#0a0f16]">
        <Image
          src={getScreenshotSrc(project.screenshot)}
          alt={`${project.title} screenshot`}
          fill
          loading="lazy"
          sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover object-top"
        />
        {/* 24% black bottom gradient overlay */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[.24] via-transparent to-transparent"
        />
        <MagneticArrow />
      </div>

      {/* meta row: odometer index + year */}
      <div className="mt-2.5 flex items-baseline justify-between font-mono text-[9px] tracking-[0.14em] text-white/35">
        <OdometerIndex index={index} delay={0.15 + index * STAGGER} />
        <span className="tabular-nums text-white/25">{yearOf(project.period)}</span>
      </div>

      {/* title — single line, always */}
      <h3 className="mt-1.5 truncate text-[13px] font-medium tracking-[-0.01em] text-white/85">
        {project.title}
      </h3>

      {/* tags — max 2, quiet mono chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {project.tech.slice(0, 2).map((tech) => (
          <span
            key={tech}
            className="max-w-[90px] truncate rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-white/45"
          >
            {tech}
          </span>
        ))}
      </div>
    </motion.article>
  );

  // Whole card is one link. No-URL builds render as static
  // articles (still styled identically, no dead affordance).
  const shellClass = "group block rounded-lg focus-visible:outline-none";

  return href ? (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${project.title} — view project`}
      className={shellClass}
    >
      {card}
    </Link>
  ) : (
    <div className={shellClass}>{card}</div>
  );
}

/* =========================================================
   SECTION
   ========================================================= */

type MoreBuildsGridProps = {
  projects: readonly Project[];
};

export default function MoreBuildsGrid({ projects }: MoreBuildsGridProps) {
  const reduceMotion = useReducedMotion();
  if (projects.length === 0) return null;

  const count = projects.length;

  return (
    <div className="mt-16 sm:mt-20">
      {/* header row: technical label + live counter readout */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-3"
      >
        <span className="technical-label">05 — MORE BUILDS</span>

        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-white/40">
          <span
            aria-hidden
            className="signal-pulse inline-block size-1.5 rounded-full bg-emerald-300"
          />
          <span className="tabular-nums">
            {count < 10 && "0"}
            <CountUp value={count} /> BUILDS
          </span>
        </span>
      </motion.div>

      {/* dense ledger grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project, index) => (
          <BuildCard key={project.slug} project={project} index={index} />
        ))}
      </div>

      {/* scanline sweep + 1.05 zoom — transform-only, scoped here
          so we don't touch the site-wide .img-zoom (1.04) token */}
      <style jsx>{`
        .scan-thumb::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 1px;
          margin: auto 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(110, 231, 183, 0.85),
            transparent
          );
          transform: translateX(-110%);
          pointer-events: none;
        }
        .group:hover .scan-thumb::after,
        .group:focus-within .scan-thumb::after {
          transform: translateX(110%);
          transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scan-thumb img {
          transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .group:hover .scan-thumb img {
          transform: scale(1.05);
        }
        @media (hover: none) {
          .scan-thumb img {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}