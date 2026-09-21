"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import type { ProfessionalExperience } from "@/data/projects";

/* =========================================================
   EXPERIENCE CARD — compact visual identity cell.
   ---------------------------------------------------------
   Deliberately carries ONLY: sharp screenshot, editorial
   index, company label, period. No description, no metrics,
   no tech — all of that lives in the right-hand information
   panel (ProfessionalExperience) as sibling content.

   - Card widths live here (percentage of the scroller) so a
     slice of the NEXT card peeks in, signalling more work.
   - `data-experience-card` is measured by the parent to
     compute scroll steps.
   - `.case-thumb` supplies the shared hover system from
     globals.css (image scale 1.04 + one scanline sweep).
   ========================================================= */

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

export function ExperienceCard({
  experience,
  index,
}: {
  experience: ProfessionalExperience;
  index: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      data-experience-card
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: EASE, delay: Math.min(index * 0.05, 0.2) }}
      aria-label={`${experience.company} — ${experience.role}`}
      className="group relative w-[80%] min-w-0 shrink-0 snap-center sm:w-[62%] lg:w-[58%] xl:w-[54%]"
    >
      <div className="case-thumb surface-elevated overflow-hidden rounded-2xl">
        {/* -------- visual only -------- */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#0a0f16]">
          <Image
            src={`/images/${experience.screenshot}`}
            alt={`${experience.company} — ${experience.role} product screenshot`}
            fill
            sizes="(max-width: 1023px) 80vw, 40vw"
            className="object-cover object-top"
          />
          {/* editorial index watermark — subtle, no heavy overlay */}
          <span
            aria-hidden
            className="absolute left-4 top-3 font-serif text-3xl tracking-[-0.04em] text-white/25 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
          >
            {pad2(index)}
          </span>
        </div>

        {/* -------- label strip -------- */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0b1015] px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="font-serif text-sm tabular-nums text-emerald-200/80">
              {pad2(index)}
            </span>
            <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-white/80">
              {experience.company}
            </span>
          </div>
          <span className="technical-label shrink-0">{experience.period}</span>
        </div>
      </div>
    </motion.article>
  );
}