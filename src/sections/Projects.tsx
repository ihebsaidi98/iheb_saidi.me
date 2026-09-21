import { SectionShell } from "@/components/ui/SectionShell";
import { ProfessionalExperience } from "@/components/projects/ProfessionalExperience";
import { OtherBuilds } from "@/components/projects/OtherBuilds";
import { professionalExperience, academicProjects } from "@/data/projects";

/* =========================================================
   PROJECTS — two deliberately different systems:
   1. SELECTED WORK  → professional experience, horizontal
                       case-study showcase
   2. OTHER BUILDS   → academic projects, editorial rows
   ========================================================= */

export function ProjectsSection() {
  return (
    <SectionShell
      id="projects"
      index="02"
      eyebrow="SELECTED WORK"
      title={
        <>
          Professional experience &<br />
          <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
            production systems.
          </span>
        </>
      }
      intro="Industrial supervision, ITSM with AI integration, and full-stack delivery across five engagements — every item below shipped to production."
    >
      <ProfessionalExperience items={professionalExperience} />
      <OtherBuilds projects={academicProjects} />
    </SectionShell>
  );
}