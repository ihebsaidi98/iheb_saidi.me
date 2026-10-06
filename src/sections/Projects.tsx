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
      label="work"
      title={["Professional experience &", "production systems."]}
      intro="Industrial supervision, ITSM with AI integration, and full-stack delivery — every item below shipped to production."
    >
      <ProfessionalExperience items={professionalExperience} />
      <OtherBuilds projects={academicProjects} />
    </SectionShell>
  );
}