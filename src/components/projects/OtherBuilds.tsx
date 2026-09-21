"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import type { AcademicProject } from "@/data/projects";
import { AcademicProjectRow } from "@/components/projects/AcademicProjectRow";

/* =========================================================
   OTHER BUILDS — academic projects as an editorial list.
   Visually distinct from Selected Work by design: no cards,
   no grid — numbered rows, generous whitespace, typography
   doing the hierarchy, images revealed on interaction.
   ========================================================= */

export function OtherBuilds({ projects }: { projects: readonly AcademicProject[] }) {
  const reduceMotion = useReducedMotion();
  if (projects.length === 0) return null;

  return (
    <div className="mt-24 sm:mt-32">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mb-2 flex items-end justify-between gap-6"
      >
        <div>
          <p className="eyebrow">03 — OTHER BUILDS</p>
          <div className="section-line" />
          <h3 className="mt-6 font-serif text-3xl tracking-[-0.03em] text-white sm:text-4xl">
            Notable academic projects
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/50 sm:text-base">
            Experiments and engineering builds from ESPRIT and Hôpital Charles
            Nicolle — technical breadth outside professional work.
          </p>
        </div>
        <span className="technical-label hidden pb-1 sm:block">
          {projects.length} PROJECTS
        </span>
      </motion.div>

      <ol className="mt-6 border-b border-white/[0.07]">
        {projects.map((project, index) => (
          <AcademicProjectRow key={project.slug} project={project} index={index} />
        ))}
      </ol>
    </div>
  );
}