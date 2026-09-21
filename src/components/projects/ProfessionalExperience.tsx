"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Image from "next/image";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { EASE } from "@/components/hero-motion";
import type { ProfessionalExperience as Experience } from "@/data/projects";

/* =========================================================
   PROFESSIONAL EXPERIENCE — interactive case-study deck
   ---------------------------------------------------------
   ONE experience at a time. Navigation is 100% clickable:
   segmented jump buttons + prev/next + arrow keys.

   NO horizontal scrolling. NO wheel handlers. NO drag.
   NO scroll listeners. NO overflow-x containers.

   Card: full screenshot at natural aspect (nothing cropped),
   label strip, technology chips. Panel: company, role,
   period, description, animated metrics, impact bullets.
   ========================================================= */

const FOCUS_RING =
  "outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-emerald-300";

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

/* -------- panel choreography: opacity + translateY only -------- */
const panelStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const panelItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

/* -------- metrics stagger in slightly after the description -------- */
const metricsStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.35, delayChildren: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const metricItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0 },
};

/* -------- tech chips: clearly visible stagger on swap -------- */
const chipStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } },
};

const chipItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.8 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 22 },
  },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.12 } },
};

/* -------- single-run count-up; reduced-motion shows final value --------
   Generic: animates any leading-integer metric (30+, 500+, 5…). */
function MetricValue({ value, delay = 0 }: { value: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const match = value.match(/^(\d+)(.*)$/);
    if (!match || reduceMotion) {
      el.textContent = value;
      return;
    }
    const target = Number(match[1]);
    const suffix = match[2];
    const controls = animate(0, target, {
      duration: 0.7,
      ease: EASE,
      delay,
      onUpdate: (v) => {
        el.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [value, delay, reduceMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  );
}

/* -------- right-hand information panel -------- */
function ExperiencePanel({ experience }: { experience: Experience }) {
  const href = experience.links?.demo ?? experience.links?.github;
  const hasMetrics = Boolean(experience.metrics && experience.metrics.length > 0);

  return (
    <motion.div
      variants={panelStagger}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex flex-col"
    >
      <motion.p variants={panelItem} className="eyebrow">
        {experience.company}
      </motion.p>

      <motion.h3
        variants={panelItem}
        className="mt-2 font-serif text-3xl leading-tight tracking-[-0.02em] text-white sm:text-4xl"
      >
        {experience.role}
      </motion.h3>

      <motion.p
        variants={panelItem}
        className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40"
      >
        {experience.period}&nbsp;&nbsp;·&nbsp;&nbsp;{experience.location}
      </motion.p>

      {/* description — animated with the panel stagger */}
      <motion.p
        variants={panelItem}
        className="mt-5 max-w-xl text-pretty text-[15px] leading-7 text-white/60"
      >
        {experience.description}
      </motion.p>

      {/* animated metrics — editorial stats, not pills */}
      {hasMetrics && (
        <motion.dl
          variants={metricsStagger}
          className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 border-t border-white/[0.06] pt-6 sm:grid-cols-4"
        >
          {experience.metrics!.slice(0, 4).map((metric, metricIndex) => (
            <motion.div key={metric.label} variants={metricItem} className="min-w-0">
              <dt className="sr-only">{metric.label}</dt>
              <dd className="font-serif text-2xl tracking-[-0.02em] text-emerald-200 sm:text-[1.65rem]">
                <MetricValue value={metric.value} delay={metricIndex * 0.3} />
              </dd>
              <dd className="mt-1 font-mono text-[9px] uppercase leading-4 tracking-[0.14em] text-white/40">
                {metric.label}
              </dd>
            </motion.div>
          ))}
        </motion.dl>
      )}

      {/* impact bullets — ALWAYS visible, under the metrics
          (or standalone with a top rule when a project has no metrics) */}
      {experience.impact.length > 0 && (
        <motion.ul
          variants={metricsStagger}
          className={`space-y-2.5 ${
            hasMetrics ? "mt-6" : "mt-7 border-t border-white/[0.06] pt-6"
          }`}
        >
          {experience.impact.slice(0, 6).map((item) => (
            <motion.li
              key={item}
              variants={metricItem}
              className="flex gap-2.5 text-[13px] leading-5 text-white/55"
            >
              <span
                aria-hidden
                className="mt-[8px] size-1 shrink-0 rounded-full bg-emerald-300/60"
              />
              {item}
            </motion.li>
          ))}
        </motion.ul>
      )}

      <motion.div variants={panelItem} className="mt-auto pt-7">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`group/cta inline-flex items-center gap-1.5 font-mono text-xs font-medium text-emerald-200 transition-colors hover:text-emerald-100 ${FOCUS_RING}`}
            aria-label={`${experience.company} — view case study`}
          >
            View case study
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5"
            >
              ↗
            </span>
          </a>
        )}
      </motion.div>
    </motion.div>
  );
}

export function ProfessionalExperience({ items }: { items: readonly Experience[] }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const goTo = useCallback(
    (index: number) => {
      setActive(Math.max(0, Math.min(items.length - 1, index)));
    },
    [items.length],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(items.length - 1);
    }
  };

  if (items.length === 0) return null;

  const current = items[active];

  return (
    <div
      role="region"
      aria-label="Professional experience"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative ${FOCUS_RING}`}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {/* header row: label + live counter */}
        <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-3">
          <span className="technical-label">02 — SELECTED WORK</span>
          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-white/40 tabular-nums">
            <span aria-hidden className="signal-pulse inline-block size-1.5 rounded-full bg-emerald-300" />
            {pad2(active)} / {pad2(items.length - 1)}
          </span>
        </div>
      </motion.div>

      {/* -------- IMAGE + TECH CARD (~48%) | INFORMATION PANEL -------- */}
      <div className="mt-2 grid items-start gap-10 lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] lg:gap-12">
        {/* LEFT — FULL screenshot at natural aspect (nothing cropped),
           label strip, technology chips */}
        <div className="case-thumb surface-elevated overflow-hidden rounded-2xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.slug}
              initial={reduceMotion ? false : { opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="relative overflow-hidden bg-[#0a0f16]"
            >
              {/* h-auto w-full: renders the whole screenshot at its real
                  proportions — sharp, undistorted, zero cropping */}
              <Image
                src={`/images/${current.screenshot}`}
                alt={`${current.company} — ${current.role} product screenshot`}
                width={1600}
                height={1000}
                sizes="(max-width: 1023px) 100vw, 45vw"
                className="block h-auto w-full"
                priority={active === 0}
              />
              {/* editorial index watermark — subtle, no heavy overlay */}
              <span
                aria-hidden
                className="absolute left-4 top-3 font-serif text-3xl tracking-[-0.04em] text-white/25 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
              >
                {pad2(active)}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* label strip under the image */}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0b1015] px-4 py-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.slug}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex min-w-0 items-baseline gap-3"
              >
                <span className="font-serif text-sm tabular-nums text-emerald-200/80">
                  {pad2(active)}
                </span>
                <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white/80">
                  {current.company}
                </span>
              </motion.div>
            </AnimatePresence>
            <span className="technical-label shrink-0">{current.period}</span>
          </div>

          {/* technology chips — ON THE CARD, visibly animated on swap */}
          <div className="border-t border-white/[0.06] bg-[#0b1015] px-4 py-3">
            <p className="technical-label mb-2">TECHNOLOGIES</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.ul
                key={`${current.slug}-tech`}
                variants={chipStagger}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="flex flex-wrap gap-1.5"
              >
                {current.tech.map((tech) => (
                  <motion.li
                    key={tech}
                    variants={chipItem}
                    whileHover={{ y: -2, scale: 1.06, borderColor: "rgba(110,231,183,0.45)", color: "rgba(167,243,208,0.9)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className="cursor-default rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/50"
                  >
                    {tech}
                  </motion.li>
                ))}
              </motion.ul>
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT — dynamic information panel (company, role, description,
           animated metrics, impact bullets) */}
        <div className="relative min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-10">
          <AnimatePresence mode="wait" initial={false}>
            <ExperiencePanel key={current.slug} experience={current} />
          </AnimatePresence>
        </div>
      </div>

      {/* -------- CLICK NAVIGATION — replaces ALL scrolling -------- */}
      <div className="mt-6 flex items-center gap-4 sm:gap-6">
        <div
          role="group"
          aria-label="Choose experience"
          className="flex flex-1 items-stretch gap-2 sm:gap-3"
        >
          {items.map((experience, index) => {
            const isActive = index === active;
            return (
              <button
                key={experience.slug}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Go to ${experience.company}: ${experience.role}`}
                aria-current={isActive ? "true" : undefined}
                className={`flex-1 py-2 ${FOCUS_RING}`}
              >
                <span
                  className={`mb-1.5 block font-mono text-[10px] tracking-[0.14em] transition-colors duration-300 tabular-nums ${
                    isActive ? "text-emerald-200" : "text-white/35"
                  }`}
                >
                  {pad2(index)}
                  <span className="ml-2 hidden truncate uppercase sm:inline">
                    {experience.company}
                  </span>
                </span>
                <span className="relative block h-px w-full overflow-hidden bg-white/15">
                  <span
                    aria-hidden
                    className={`absolute inset-0 origin-left bg-emerald-300 transition-transform duration-500 ${
                      isActive ? "scale-x-100" : "scale-x-0"
                    }`}
                    style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* subtle prev / next — small case-study controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous experience"
            className={`grid size-10 place-items-center rounded-full border border-white/10 text-white/60 transition-colors duration-300 hover:border-emerald-200/40 hover:text-emerald-100 disabled:pointer-events-none disabled:opacity-25 ${FOCUS_RING}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === items.length - 1}
            aria-label="Next experience"
            className={`grid size-10 place-items-center rounded-full border border-white/10 text-white/60 transition-colors duration-300 hover:border-emerald-200/40 hover:text-emerald-100 disabled:pointer-events-none disabled:opacity-25 ${FOCUS_RING}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Experience {active + 1} of {items.length}: {current.company}
      </p>
    </div>
  );
}