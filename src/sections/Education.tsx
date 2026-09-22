"use client";

import { motion } from "framer-motion";
import { Chip } from "@/components/ui/Chip";
import { SectionShell } from "@/components/ui/SectionShell";
import { education, type EducationEntry } from "@/data/education";

// DATA FIELDS USED per entry:
//   degree, school? | institution?, period, description? | details?, gpa?, courses?[]

// If your Education data currently lives inside About.tsx, delete it from there.

export function EducationSection() {
  return (
    <SectionShell
      id="education"
      index="04"
      eyebrow="EDUCATION"
      title="Foundations."
    >
      <div className="max-w-4xl">
        {education.map((entry: EducationEntry, i: number) => {
          const courses = entry.courses ?? [];

          return (
            <motion.div
              key={`${entry.degree}-${entry.period}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="row-sweep group flex flex-col gap-3 border-b border-white/[0.07] py-7 sm:flex-row sm:items-start sm:gap-8"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl tracking-[-0.02em] text-white transition-transform duration-300 group-hover:translate-x-1 sm:text-2xl">
                  {entry.degree}
                </h3>
                <p className="mt-1 font-mono text-[12px] text-emerald-200/60">
                  {entry.school ?? entry.institution}
                </p>
                {(entry.description ?? entry.details) && (
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {entry.description ?? entry.details}
                  </p>
                )}
                {entry.gpa && (
                  <p className="mt-2 font-mono text-[11px] text-white/35">
                    GPA: <span className="text-white/60">{entry.gpa}</span>
                  </p>
                )}
              </div>

              <div className="sm:text-right">
                <div className="font-mono text-[11px] text-white/35 tabular-nums">
                  {entry.period}
                </div>
                {courses.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 sm:justify-end">
                    {courses.map((c: string) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </SectionShell>
  );
}