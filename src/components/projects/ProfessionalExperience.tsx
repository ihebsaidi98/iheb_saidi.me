"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type WheelEvent as ReactWheelEvent,
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

   Design rules:
   - No technology chips
   - No horizontal scrolling
   - No drag
   - One wheel gesture = one project
   - Equal visual dimensions for every project
   - Stable layout when switching projects
   - Directional project transitions
   - Metrics remain visible
   - Screenshots are never cropped
   - Period appears only inside the visual card
   - Right panel focuses on role, description, metrics and impact
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
   DIRECTIONAL PROJECT TRANSITION
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
      duration: 3.0,
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
      {/* ROLE */}

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
          className={`space-y-3 ${hasMetrics
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

  const wheelLockRef = useRef(false);

  const wheelUnlockTimer = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

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
     MOUSE WHEEL NAVIGATION
     ======================================================= */

  const onWheel = (
    event: ReactWheelEvent<HTMLDivElement>,
  ) => {
    if (items.length <= 1) {
      return;
    }

    if (Math.abs(event.deltaY) < 18) {
      return;
    }

    if (wheelLockRef.current) {
      event.preventDefault();
      return;
    }

    const movingForward = event.deltaY > 0;

    const nextIndex = movingForward
      ? active + 1
      : active - 1;

    if (
      nextIndex < 0 ||
      nextIndex > items.length - 1
    ) {
      return;
    }

    event.preventDefault();

    wheelLockRef.current = true;

    goTo(
      nextIndex,
      movingForward ? 1 : -1,
    );

    wheelUnlockTimer.current =
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 650);
  };

  /* =======================================================
     CLEANUP
     ======================================================= */

  useEffect(() => {
    return () => {
      if (wheelUnlockTimer.current) {
        clearTimeout(wheelUnlockTimer.current);
      }
    };
  }, []);

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
      onWheel={onWheel}
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

            {pad2(active)} / {pad2(items.length - 1)}
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
            {/* IMAGE */}

      {/* IMAGE */}
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
      {/* Blurred screenshot background */}
      <div
        aria-hidden
        className="absolute inset-[-8%] overflow-hidden"
      >
        <Image
          src={`/images/${current.screenshot}`}
          alt=""
          fill
          sizes="(max-width: 1023px) 100vw, 45vw"
          className="scale-110 object-cover object-center opacity-2 blur-2xl"
          priority={active === 0}
        />

        {/* Dark translucent layer to keep the foreground readable */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Soft glass-like atmosphere */}
      <div
        aria-hidden
        className="absolute inset-0 bg-white/[0.025]"
      />

      {/* Main screenshot */}
      <div className="absolute inset-0 flex items-center justify-center px-5 py-7 sm:px-7 lg:px-6">
        <motion.div
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
          className="relative aspect-video w-full max-w-[560px]"
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

      {/* Project number */}
      <span
        aria-hidden
        className="absolute left-4 top-3 z-20 font-serif text-3xl tracking-[-0.04em] text-white/30"
      >
        {pad2(active)}
      </span>
    </motion.div>
  </AnimatePresence>
</div>
            {/* COMPANY + PERIOD */}

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
          NAVIGATION
          ===================================================== */}

      <div className="mt-7 flex items-center gap-4 sm:gap-6">
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
                <span
                  className={`mb-1.5 block font-mono text-[10px] tracking-[0.14em] transition-colors duration-300 tabular-nums ${isActive
                    ? "text-emerald-200"
                    : "text-white/35"
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
                    className={`absolute inset-0 origin-left bg-emerald-300 transition-transform duration-500 ${isActive
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

        {/* PREVIOUS / NEXT */}

        <div className="flex items-center gap-2">
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

      {/* SCREEN READER STATUS */}

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