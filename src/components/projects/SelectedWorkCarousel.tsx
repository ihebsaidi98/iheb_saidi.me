"use client";

import Image from "next/image";
import {
  motion,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Chip } from "@/components/ui/Chip";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { Project } from "@/data/projects";

/* =========================================================
   CONFIG
   ---------------------------------------------------------
   The fix for "inconsistent card sizes": every card gets a
   FIXED height (CARD_HEIGHT), not a height that grows with
   however much description/metrics/tech a given project has.
   Content that overflows is clamped, and short content still
   fills the shell via flex — so cards are pixel-identical
   regardless of copy length.
   ========================================================= */

const GAP = 32; // px — must match the track `gap`
const MAX_CARD_WIDTH = 880; // px — card never exceeds this
const CARD_HEIGHT_DESKTOP = 560; // px — fixed, all cards match
const CARD_HEIGHT_MOBILE = 620; // px — a bit taller: stacked metrics need room

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function getScreenshotSrc(screenshot: string) {
  return screenshot.startsWith("/") ? screenshot : `/images/${screenshot}`;
}

/* =========================================================
   3D CARD
   ========================================================= */

type FeaturedCardProps = {
  project: Project;
  index: number;
  offset: number; // index - activeIndex
  total: number;
  cardWidth: number;
  onSelect: (index: number) => void;
};

function FeaturedCard({
  project,
  index,
  offset,
  total,
  cardWidth,
  onSelect,
}: FeaturedCardProps) {
  const reduceMotion = useReducedMotion();
  const distance = Math.abs(offset);
  const isActive = offset === 0;

  const rotateY = reduceMotion ? 0 : clamp(offset * -22, -44, 44);
  const depth = reduceMotion ? 0 : -distance * 90;
  // NOTE: scale is a *visual* 3D cue only — it never changes the card's
  // box size (width/height stay fixed), so layout never shifts.
  const scale = 1 - Math.min(distance, 2) * 0.05;
  const opacity = isActive ? 1 : distance === 1 ? 0.78 : 0.42;

  return (
    <motion.article
      aria-hidden={!isActive}
      onClick={() => {
        if (!isActive) onSelect(index);
      }}
      className={`relative shrink-0 select-none ${
        !isActive ? "cursor-pointer" : ""
      }`}
      style={{
        width: cardWidth || "min(88vw, 880px)",
        height: "var(--card-h)",
        zIndex: 30 - distance,
        transformStyle: "preserve-3d",
      }}
      animate={{ rotateY, z: depth, scale, opacity }}
      transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
    >
      <SpotlightCard className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-colors duration-300 hover:border-white/20">
        {/* ---------- screenshot, fixed aspect ---------- */}
        <div className="img-zoom relative aspect-[16/9] shrink-0 overflow-hidden border-b border-white/[0.07] bg-[#0a0f16]">
          <motion.div
            className="absolute inset-0"
            animate={{ x: reduceMotion ? 0 : offset * -28 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
          >
            <Image
              src={getScreenshotSrc(project.screenshot)}
              alt={`${project.title} screenshot`}
              fill
              priority={index === 0}
              sizes="(max-width: 768px) 88vw, 880px"
              className="object-cover object-top"
            />
          </motion.div>

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04070c]/45 via-transparent to-transparent" />

          <span className="absolute left-4 top-4 rounded-full border border-white/10 bg-[#04070c]/70 px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-white/50 backdrop-blur">
            FEATURED
          </span>

          <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#04070c]/70 px-2.5 py-1 font-mono text-[9px] tabular-nums tracking-[0.12em] text-white/40 backdrop-blur">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
        </div>

        {/* ---------- body: flex-1 fills whatever room is left
             below the fixed-height image, so the shell is always
             CARD_HEIGHT regardless of copy length ---------- */}
        <div
          className={`flex min-h-0 flex-1 flex-col ${
            isActive ? "" : "pointer-events-none"
          }`}
        >
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200/55">
                  {project.organization} · {project.role}
                </p>
                <h3 className="mt-2 truncate font-serif text-2xl tracking-[-0.035em] text-white sm:text-3xl lg:text-4xl">
                  {project.title}
                </h3>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-white/25">
                {project.period}
              </span>
            </div>

            {/* clamped to 3 lines so a long description never grows the card */}
            <p className="mt-4 line-clamp-3 max-w-3xl text-pretty text-sm leading-6 text-white/50 sm:text-[15px]">
              {project.description}
            </p>

            {/* metrics row: height is reserved even when a project has
                 none, so the border/spacing below never jumps around */}
            <div className="mt-6 grid min-h-[68px] grid-cols-2 gap-y-5 border-t border-white/[0.07] pt-5 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-4">
              {project.metrics && project.metrics.length > 0
                ? project.metrics.slice(0, 4).map((metric) => (
                    <div key={metric.label}>
                      <div className="font-serif text-xl text-white sm:text-2xl">
                        {metric.value}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
                        {metric.label}
                      </div>
                    </div>
                  ))
                : null}
            </div>

            <div className="mt-auto flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {project.tech.slice(0, 6).map((technology) => (
                  <Chip key={technology}>{technology}</Chip>
                ))}
              </div>

              {project.links?.demo || project.links?.github ? (
                <div className="flex items-center gap-4">
                  {project.links.demo && (
                    <a
                      href={project.links.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-white/45 transition-colors hover:text-emerald-300"
                    >
                      live
                    </a>
                  )}
                  {project.links.github && (
                    <a
                      href={project.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-white/45 transition-colors hover:text-emerald-300"
                    >
                      source
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SpotlightCard>
    </motion.article>
  );
}

/* =========================================================
   CAROUSEL
   ========================================================= */

type SelectedWorkCarouselProps = {
  projects: readonly Project[];
};

export default function SelectedWorkCarousel({
  projects,
}: SelectedWorkCarouselProps) {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () =>
      setCardWidth(Math.min(viewport.clientWidth, MAX_CARD_WIDTH));
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActive((current) => clamp(current, 0, projects.length - 1));
  }, [projects.length]);

  if (projects.length === 0) return null;

  const step = cardWidth + GAP;
  const maxIndex = projects.length - 1;
  const canPrev = active > 0;
  const canNext = active < maxIndex;

  const goTo = (index: number) => setActive(clamp(index, 0, maxIndex));
  const prev = () => goTo(active - 1);
  const next = () => goTo(active + 1);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if ((offset.x < -60 || velocity.x < -400) && canNext) next();
    else if ((offset.x > 60 || velocity.x > 400) && canPrev) prev();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" && canPrev) {
      event.preventDefault();
      prev();
    } else if (event.key === "ArrowRight" && canNext) {
      event.preventDefault();
      next();
    }
  };

  const progress = ((active + 1) / projects.length) * 100;

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Selected work"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative outline-none"
      style={
        {
          "--card-h": `${CARD_HEIGHT_MOBILE}px`,
        } as React.CSSProperties
      }
    >
      <style jsx>{`
        @media (min-width: 640px) {
          div[role="group"] {
            --card-h: ${CARD_HEIGHT_DESKTOP}px;
          }
        }
      `}</style>

      {/* ---------- glass side arrows (desktop) ---------- */}
      <button
        type="button"
        onClick={prev}
        disabled={!canPrev}
        aria-label="Previous project"
        className="absolute -left-3 top-[34%] z-40 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#080d12]/80 font-mono text-sm text-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:border-emerald-300/40 hover:text-white disabled:pointer-events-none disabled:opacity-20 sm:flex lg:-left-6"
      >
        ←
      </button>
      <button
        type="button"
        onClick={next}
        disabled={!canNext}
        aria-label="Next project"
        className="absolute -right-3 top-[34%] z-40 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#080d12]/80 font-mono text-sm text-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:border-emerald-300/40 hover:text-white disabled:pointer-events-none disabled:opacity-20 sm:flex lg:-right-6"
      >
        →
      </button>

      {/* ---------- header / inline arrows (mobile) ---------- */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/30">
            Featured systems
          </p>
          <p
            className="mt-1 font-mono text-[10px] text-white/20"
            aria-live="polite"
          >
            {String(active + 1).padStart(2, "0")}
            <span className="mx-1">/</span>
            {String(projects.length).padStart(2, "0")}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={prev}
            disabled={!canPrev}
            aria-label="Previous project"
            className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] font-mono text-sm text-white/50 transition-all hover:border-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-20"
          >
            ←
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            aria-label="Next project"
            className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] font-mono text-sm text-white/50 transition-all hover:border-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-20"
          >
            →
          </button>
        </div>
      </div>

      {/* ---------- 3D viewport ---------- */}
      <div
        ref={viewportRef}
        className="overflow-hidden py-2"
        style={{ perspective: 1400 }}
      >
        <motion.div
          className="flex w-max cursor-grab touch-pan-y active:cursor-grabbing"
          style={{ gap: GAP, transformStyle: "preserve-3d" }}
          drag={projects.length > 1 ? "x" : false}
          dragConstraints={{ left: -(maxIndex * step), right: 0 }}
          dragElastic={0.06}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          animate={{ x: -active * step }}
          transition={{
            type: "spring",
            stiffness: reduceMotion ? 500 : 240,
            damping: reduceMotion ? 40 : 30,
            mass: 0.6,
          }}
        >
          {projects.map((project, index) => (
            <FeaturedCard
              key={project.slug}
              project={project}
              index={index}
              offset={index - active}
              total={projects.length}
              cardWidth={cardWidth}
              onSelect={goTo}
            />
          ))}
        </motion.div>
      </div>

      {/* ---------- progress + dots ---------- */}
      <div className="mt-6 flex items-center gap-4">
        <div className="h-px flex-1 overflow-hidden bg-white/[0.07]">
          <motion.div
            className="h-full bg-emerald-300/60"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        </div>

        <div className="flex items-center gap-1">
          {projects.map((project, index) => (
            <button
              key={project.slug}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to ${project.title}`}
              aria-current={index === active}
              className="p-1"
            >
              <span
                className={`block h-1 rounded-full transition-all duration-300 ${
                  index === active
                    ? "w-8 bg-white/70"
                    : "w-3 bg-white/15 hover:bg-white/30"
                }`}
              />
            </button>
          ))}
        </div>

        <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-white/20 sm:block">
          Drag · Swipe · ← →
        </span>
      </div>
    </div>
  );
}
