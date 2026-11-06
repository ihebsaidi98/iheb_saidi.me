"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { StatusDot } from "@/components/ui/StatusDot";
import { useA11yMode } from "@/components/MotionProvider";
import { SectionShell } from "@/components/ui/SectionShell";
import { experience, type ExperienceEntry } from "@/data/experience";
import { staggeredCardItem, staggeredCardList } from "@/lib/motion";

// DATA FIELDS USED per job:
//   title? | role?, company, period ("Jul 2024 – Jan 2026"), description? | summary?,
//   bullets?[] , tech?[] , location?
// "current" is auto-detected from the word "present" in `period` (case-insensitive).

function isCurrent(period: string) {
  return /present/i.test(period);
}

function yearOf(period: string) {
  const m = period.match(/\d{4}/);
  return m ? m[0] : "";
}

function JobCard({ job, a11yMode }: { job: ExperienceEntry; a11yMode: boolean }) {
  const current = isCurrent(job.period);

  return (
    <motion.article
      variants={staggeredCardItem}
      initial={a11yMode ? false : "hidden"}
      whileInView={"show"}
      viewport={{ once: true, amount: 0.2 }}
      className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors duration-300 hover:border-white/20 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl tracking-[-0.02em] text-white sm:text-2xl">
            {job.role}
          </h3>
          <p className="mt-1 font-mono text-[12px] text-emerald-200/60">{job.organization}</p>
        </div>
        {current && (
          <span className="flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-3 py-1">
            <StatusDot size={6} className="shrink-0" />
            <span className="font-mono text-[9px] tracking-[0.18em] text-emerald-200/80">
              PRESENT
            </span>
          </span>
        )}
      </div>

      {job.details.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {job.details.map((detail, i) => (
            <li key={`${job.organization}-${i}`} className="flex gap-3 text-sm leading-6 text-white/55">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-emerald-300/50" />
              {detail}
            </li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}

export function ExperienceSection() {
  const a11yMode = useA11yMode();
  const { scrollYProgress } = useScroll({
    offset: ["start center", "end center"],
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 90, damping: 22 });

  return (
    <SectionShell
      id="experience"
      label="experience"
      title="Where I've shipped."
      intro="Full-time engineering and internship work — every role below shipped to production."
    >
      <div className="relative z-10 min-h-full" style={{ position: "relative" }}>
        {/* timeline track + scroll progress line */}
        <div aria-hidden className="absolute bottom-0 left-[7px] top-0 z-0 w-px bg-white/[0.08]" />
        <motion.div
          aria-hidden
          style={{ scaleY }}
          className="absolute bottom-0 left-[7px] top-0 z-0 w-px origin-top bg-gradient-to-b from-emerald-300/60 to-cyan-400/20"
        />

        <motion.div
          variants={staggeredCardList}
          initial={a11yMode ? false : "hidden"}
          whileInView={"show"}
          viewport={{ once: true, amount: 0.2 }}
          className="relative z-10 space-y-10 pl-8 sm:pl-12"
        >
          {experience.map((job) => (
            <div key={`${job.organization}-${job.period}`} className="relative z-10 lg:grid lg:grid-cols-[140px_1fr] lg:gap-8">
              {/* node dot */}
              <span
                aria-hidden
                className={`absolute -left-8 top-8 size-[15px] rounded-full border-2 sm:-left-12 ${
                  isCurrent(job.period)
                    ? "border-emerald-300 bg-emerald-300/30"
                    : "border-white/20 bg-[#04070c]"
                }`}
              />
              {/* sticky year column (desktop) */}
              <div className="relative z-10 hidden lg:block">
                <div className="sticky top-28 pt-7">
                  <span className="font-mono text-xs tracking-wider text-white/50 tabular-nums">
                    {yearOf(job.period)}
                  </span>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
                    {job.period}
                  </div>
                </div>
              </div>
              {/* mobile period (inline) */}
              <div className="mb-3 font-mono text-[10px] tracking-wider text-white/50 lg:hidden">
                {job.period}
              </div>
              <JobCard job={job} a11yMode={a11yMode} />
            </div>
          ))}
        </motion.div>
      </div>
    </SectionShell>
  );
}