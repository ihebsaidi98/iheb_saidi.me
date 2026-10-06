"use client";

import { motion } from "framer-motion";
import { useA11yMode } from "@/components/MotionProvider";
import { Chip } from "@/components/ui/Chip";
import { SectionShell } from "@/components/ui/SectionShell";
import { education, type EducationEntry } from "@/data/education";
import { staggeredCardItem, staggeredCardList } from "@/lib/motion";

// DATA FIELDS USED per entry:
//   degree, school? | institution?, period, description? | details?, gpa?, courses?[]

// If your Education data currently lives inside About.tsx, delete it from there.

export function EducationSection() {
  const a11yMode = useA11yMode();
  return (
    <SectionShell
      id="education"
      label="education"
      title="Foundations."
      intro="The fundamentals, systems thinking, and applied research behind the delivery work above."
    >
      <motion.div
        variants={staggeredCardList}
        initial={a11yMode ? false : "hidden"}
        whileInView={"show"}
        viewport={{ once: true, amount: 0.2 }}
        className="max-w-4xl"
      >
        {education.map((entry: EducationEntry) => {
          const courses = entry.courses ?? [];

          return (
            <motion.div
              key={`${entry.degree}-${entry.period}`}
              variants={staggeredCardItem}
              initial={a11yMode ? false : "hidden"}
              whileInView={"show"}
              viewport={{ once: true, amount: 0.2 }}
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
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {entry.description ?? entry.details}
                  </p>
                )}
                {entry.gpa && (
                  <p className="mt-2 font-mono text-[11px] text-white/55">
                    GPA: <span className="text-white/60">{entry.gpa}</span>
                  </p>
                )}
              </div>

              <div className="sm:text-right">
                <div className="font-mono text-[11px] text-white/55 tabular-nums">
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
      </motion.div>
    </SectionShell>
  );
}