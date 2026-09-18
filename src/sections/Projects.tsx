import SelectedWorkCarousel from "@/components/projects/SelectedWorkCarousel";
import MoreBuildsGrid from "@/components/projects/MoreBuildsGrid";
import { SectionShell } from "@/components/ui/SectionShell";
import { additionalProjects, featuredProjects } from "@/data/projects";

export function ProjectsSection() {
  return (
    <SectionShell
      id="projects"
      index="02"
      eyebrow="SELECTED WORK"
      title="Projects with real users, real load, real constraints."
      intro="Production systems from Novatek and Tunisair alongside university and internship builds — the metrics are measured, not estimated."
    >
      <SelectedWorkCarousel projects={featuredProjects} />
      <MoreBuildsGrid projects={additionalProjects} />
    </SectionShell>
  );
}

export default ProjectsSection;