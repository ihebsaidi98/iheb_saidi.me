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
   PROFESSIONAL EXPERIENCE — CASE STUDY DECK

   Interaction:
   - Normal page scrolling
   - Mouse wheel NEVER changes project
   - Bottom navigation changes project
   - Previous / Next buttons change project
   - Keyboard arrows change project
   - Subtle image parallax while scrolling
   - No horizontal scrolling
   - No drag
   - Screenshots are never cropped
   - Period appears only inside the visual card
   ========================================================= */

const FOCUS_RING =
  "outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-emerald-300";

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

/* =========================================================
   PANEL ANIMATION
   ========================================================= */

const panelStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.16,
      ease: EASE,
    },
  },
};

const panelItem: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.16,
      ease: EASE,
    },
  },
};

/* =========================================================
   METRICS ANIMATION
   ========================================================= */

const metricsStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.16,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.12,
    },
  },
};

const metricItem: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      ease: EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.12,
    },
  },
};

/* =========================================================
   PROJECT TRANSITION
   ========================================================= */

const projectTransition: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 32 : -32,
    scale: 0.992,
  }),

  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.48,
      ease: EASE,
    },
  },

  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -24 : 24,
    scale: 0.992,
    transition: {
      duration: 0.32,
      ease: EASE,
    },
  }),
};

/* =========================================================
   METRIC COUNT-UP
   ========================================================= */

function MetricValue({
  value,
  delay = 0,
}: {
  value: string;
  delay?: number;
}) {
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
      duration: 1.2,
      ease: EASE,
      delay,
      onUpdate: (currentValue) => {
        el.textContent = `${Math.round(currentValue)}${suffix}`;
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

/* =========================================================
   INFORMATION PANEL
   ========================================================= */

function ExperiencePanel({
  experience,
}: {
  experience: Experience;
  direction: number;
}) {
  const href =
    experience.links?.demo ??
    experience.links?.github;

  const hasMetrics = Boolean(
    experience.metrics &&
      experience.metrics.length > 0,
  );

  return (
    <motion.div
      variants={panelStagger}
      initial="hidden"
      animate="show"
      exit="exit"
      className="flex h-full min-h-0 flex-col lg:min-h-[560px]"
    >
      {/* PROJECT TITLE */}

      <motion.h3
        variants={panelItem}
        className="mt-0 font-serif text-3xl leading-[1.05] tracking-[-0.03em] text-white sm:text-4xl xl:text-[2.7rem]"
      >
        {experience.role}
      </motion.h3>

      {/* DESCRIPTION */}

      <motion.p
        variants={panelItem}
        className="mt-6 max-w-xl text-[15px] leading-7 text-white/60"
      >
        {experience.description}
      </motion.p>

      {/* METRICS */}

      {hasMetrics && (
        <motion.dl
          variants={metricsStagger}
          className="mt-8 grid grid-cols-2 gap-x-5 gap-y-7 border-t border-white/[0.07] pt-7 sm:grid-cols-4"
        >
          {(experience.metrics ?? [])
            .slice(0, 4)
            .map((metric, metricIndex) => (
              <motion.div
                key={metric.label}
                variants={metricItem}
                className="min-w-0"
              >
                <dt className="sr-only">
                  {metric.label}
                </dt>

                <dd className="font-serif text-2xl tracking-[-0.03em] text-emerald-200 sm:text-[1.7rem]">
                  <MetricValue
                    value={metric.value}
                    delay={metricIndex * 0.12}
                  />
                </dd>

                <dd className="mt-1 font-mono text-[9px] uppercase leading-4 tracking-[0.13em] text-white/35">
                  {metric.label}
                </dd>
              </motion.div>
            ))}
        </motion.dl>
      )}

      {/* IMPACT */}

      {experience.impact.length > 0 && (
        <motion.ul
          variants={metricsStagger}
          className={`space-y-3 ${
            hasMetrics
              ? "mt-7"
              : "mt-7 border-t border-white/[0.07] pt-7"
          }`}
        >
          {experience.impact
            .slice(0, 4)
            .map((item) => (
              <motion.li
                key={item}
                variants={metricItem}
                className="flex gap-3 text-[13px] leading-5 text-white/55"
              >
                <span
                  aria-hidden
                  className="mt-[8px] size-1 shrink-0 rounded-full bg-emerald-300/60"
                />

                <span>{item}</span>
              </motion.li>
            ))}
        </motion.ul>
      )}

      {/* CTA */}

      <motion.div
        variants={panelItem}
        className="mt-auto pt-8"
      >
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`group/cta inline-flex items-center gap-2 font-mono text-xs font-medium text-emerald-200 transition-colors hover:text-emerald-100 ${FOCUS_RING}`}
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

/* =========================================================
   MAIN EXPERIENCE SHOWCASE
   ========================================================= */

export function ProfessionalExperience({
  items,
}: {
  items: readonly Experience[];
}) {
  const reduceMotion = useReducedMotion();

  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);

  /*
   * Ref used only for the visual parallax.
   * It does NOT control project navigation.
   */
  const visualRef = useRef<HTMLDivElement>(null);

  /* =======================================================
     PROJECT NAVIGATION
     ======================================================= */

  const goTo = useCallback(
    (
      index: number,
      forcedDirection?: number,
    ) => {
      const nextIndex = Math.max(
        0,
        Math.min(items.length - 1, index),
      );

      if (nextIndex === active) {
        return;
      }

      const calculatedDirection =
        nextIndex > active ? 1 : -1;

      setDirection(
        forcedDirection ??
          calculatedDirection,
      );

      setActive(nextIndex);
    },
    [active, items.length],
  );

  /* =======================================================
     SUBTLE SCROLL PARALLAX
     
     IMPORTANT:
     This only moves the visual.
     It NEVER changes the active project.
     ======================================================= */

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const handleScroll = () => {
      const element = visualRef.current;

      if (!element) {
        return;
      }

      const rect =
        element.getBoundingClientRect();

      const viewportCenter =
        window.innerHeight / 2;

      const elementCenter =
        rect.top + rect.height / 2;

      const distance =
        elementCenter - viewportCenter;

      const offset = Math.max(
        -14,
        Math.min(14, distance * -0.025),
      );

      element.style.transform = `translate3d(0, ${offset}px, 0)`;
    };

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true },
    );

    handleScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, [reduceMotion]);

  /* =======================================================
     KEYBOARD NAVIGATION
     ======================================================= */

  const onKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1, -1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1, 1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      goTo(0, -1);
    }

    if (event.key === "End") {
      event.preventDefault();
      goTo(items.length - 1, 1);
    }
  };

  if (items.length === 0) {
    return null;
  }

  const current = items[active];

  return (
    <div
      role="region"
      aria-label="Professional experience"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative ${FOCUS_RING}`}
    >
      {/* =====================================================
          SECTION HEADER
          ===================================================== */}

      <motion.div
        initial={
          reduceMotion
            ? false
            : {
                opacity: 0,
                y: 16,
              }
        }
        whileInView={{
          opacity: 1,
          y: 0,
        }}
        viewport={{
          once: true,
          margin: "-8% 0px",
        }}
        transition={{
          duration: 0.6,
          ease: EASE,
        }}
      >
        <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-3">
          <span className="technical-label">
            02 — SELECTED WORK
          </span>

          <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-white/40 tabular-nums">
            <span
              aria-hidden
              className="signal-pulse inline-block size-1.5 rounded-full bg-emerald-300"
            />

            {pad2(active)} /{" "}
            {pad2(items.length - 1)}
          </span>
        </div>
      </motion.div>

      {/* =====================================================
          PROJECT STAGE
          ===================================================== */}

      <div className="mt-2 grid items-stretch gap-10 lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] lg:gap-12">
        {/* ===================================================
            LEFT — PROJECT VISUAL
            =================================================== */}

        <div className="flex min-w-0">
          <div className="case-thumb surface-elevated flex w-full flex-col overflow-hidden rounded-2xl lg:h-[560px]">
            {/* =================================================
                IMAGE
                ================================================= */}

            <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden bg-[#101418] lg:min-h-0 lg:flex-1 lg:aspect-auto">
              <AnimatePresence
                mode="wait"
                initial={false}
                custom={direction}
              >
                <motion.div
                  key={current.slug}
                  custom={direction}
                  variants={projectTransition}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0"
                >
                  {/* =========================================
                      BLURRED PROJECT BACKGROUND
                      ========================================= */}

                  <div
                    aria-hidden
                    className="absolute inset-[-8%] overflow-hidden"
                  >
                    <Image
                      src={`/images/${current.screenshot}`}
                      alt=""
                      fill
                      sizes="(max-width: 1023px) 100vw, 45vw"
                      className="scale-110 object-cover object-center opacity-10 blur-sm"
                      priority={active === 0}
                    />

                    {/* Soft dark overlay */}
                    <div className="absolute inset-0 bg-black/20" />

                    {/* Slight atmospheric layer */}
                    <div className="absolute inset-0 bg-white/[0.025]" />
                  </div>

                  {/* =========================================
                      MAIN SCREENSHOT
                      ========================================= */}

                  <div className="absolute inset-0 flex items-center justify-center px-5 py-7 sm:px-7 lg:px-6">
                    <motion.div
                      ref={visualRef}
                      initial={{
                        opacity: 0,
                        scale: 0.96,
                        y: 12,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                      }}
                      transition={{
                        duration: 0.45,
                        ease: EASE,
                      }}
                      className="relative aspect-video w-full max-w-[560px] will-change-transform"
                    >
                      <Image
                        src={`/images/${current.screenshot}`}
                        alt={`${current.company} — ${current.role} product screenshot`}
                        fill
                        sizes="(max-width: 1023px) 100vw, 45vw"
                        className="object-contain object-center drop-shadow-[0_18px_35px_rgba(0,0,0,0.35)]"
                        priority={active === 0}
                      />
                    </motion.div>
                  </div>

                  {/* =========================================
                      PROJECT NUMBER
                      ========================================= */}

                  <span
                    aria-hidden
                    className="absolute left-4 top-3 z-20 font-serif text-3xl tracking-[-0.04em] text-white/30"
                  >
                    {pad2(active)}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* =================================================
                COMPANY + LOCATION + PERIOD
                ================================================= */}

            <div className="flex h-[52px] shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#0b1015] px-4">
              <AnimatePresence
                mode="wait"
                initial={false}
                custom={direction}
              >
                <motion.div
                  key={current.slug}
                  custom={direction}
                  variants={projectTransition}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex w-full items-center justify-between"
                >
                  {/* COMPANY */}

                  <div className="min-w-0">
                    <span className="block truncate font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white/75">
                      {current.company}
                    </span>

                    {/* LOCATION */}

                    <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
                      {current.location}
                    </span>
                  </div>

                  {/* PERIOD */}

                  <span className="ml-4 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
                    {current.period}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ===================================================
            RIGHT — INFORMATION
            =================================================== */}

        <div className="relative min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-10">
          <AnimatePresence
            mode="wait"
            initial={false}
            custom={direction}
          >
            <motion.div
              key={current.slug}
              custom={direction}
              variants={projectTransition}
              initial="enter"
              animate="center"
              exit="exit"
              className="h-full"
            >
              <ExperiencePanel
                experience={current}
                direction={direction}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* =====================================================
          PROJECT NAVIGATION
          ===================================================== */}

      <div className="mt-7 flex items-center gap-4 sm:gap-6">
        {/* PROJECT SELECTOR */}

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
                onClick={() =>
                  goTo(
                    index,
                    index > active ? 1 : -1,
                  )
                }
                aria-label={`Go to ${experience.company}: ${experience.role}`}
                aria-current={
                  isActive
                    ? "true"
                    : undefined
                }
                className={`flex-1 py-2 ${FOCUS_RING}`}
              >
                {/* NUMBER + COMPANY */}

                <span
                  className={`mb-1.5 block font-mono text-[10px] tracking-[0.14em] transition-colors duration-300 tabular-nums ${
                    isActive
                      ? "text-emerald-200"
                      : "text-white/35"
                  }`}
                >
                  {pad2(index)}

                  <span className="ml-2 hidden truncate uppercase sm:inline">
                    {experience.company}
                  </span>
                </span>

                {/* PROGRESS LINE */}

                <span className="relative block h-px w-full overflow-hidden bg-white/15">
                  <span
                    aria-hidden
                    className={`absolute inset-0 origin-left bg-emerald-300 transition-transform duration-500 ${
                      isActive
                        ? "scale-x-100"
                        : "scale-x-0"
                    }`}
                    style={{
                      transitionTimingFunction:
                        "cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* ===================================================
            PREVIOUS / NEXT
            =================================================== */}

        <div className="flex items-center gap-2">
          {/* PREVIOUS */}

          <button
            type="button"
            onClick={() =>
              goTo(active - 1, -1)
            }
            disabled={active === 0}
            aria-label="Previous experience"
            className={`grid size-10 place-items-center rounded-full border border-white/10 text-white/60 transition-all duration-300 hover:border-emerald-200/40 hover:text-emerald-100 disabled:pointer-events-none disabled:opacity-25 ${FOCUS_RING}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-4"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>

          {/* NEXT */}

          <button
            type="button"
            onClick={() =>
              goTo(active + 1, 1)
            }
            disabled={
              active === items.length - 1
            }
            aria-label="Next experience"
            className={`grid size-10 place-items-center rounded-full border border-white/10 text-white/60 transition-all duration-300 hover:border-emerald-200/40 hover:text-emerald-100 disabled:pointer-events-none disabled:opacity-25 ${FOCUS_RING}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-4"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* =====================================================
          SCREEN READER STATUS
          ===================================================== */}

      <p
        className="sr-only"
        aria-live="polite"
      >
        Experience {active + 1} of{" "}
        {items.length}: {current.company}
      </p>
    </div>
  );
}