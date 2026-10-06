"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/hero-motion";
import { SectionHeader } from "@/components/ui/SectionShell";
import type { AcademicProject } from "@/data/projects";
import { AcademicProjectRow } from "@/components/projects/AcademicProjectRow";

export function OtherBuilds({ projects }: { projects: readonly AcademicProject[] }) {
  const reduceMotion = useReducedMotion();
  if (projects.length === 0) return null;

  return (
    <div className="mt-24 sm:mt-32">
      <SectionHeader
        label="projects"
        title={["Notable academic", "projects."]}
        intro="Experiments and engineering builds from ESPRIT and Hôpital Charles Nicolle — technical breadth outside professional work."
        headingId="projects-subheader-title"
      />

      <motion.ol
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-12 border-b border-white/[0.07]"
      >
        {projects.map((project, index) => (
          <AcademicProjectRow key={project.slug} project={project} index={index} />
        ))}
      </motion.ol>
    </div>
  );
}