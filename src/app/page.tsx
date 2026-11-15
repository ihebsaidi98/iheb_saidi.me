import { Header } from "@/sections/header";
import { HeroSection } from "@/sections/hero";
import { ProjectsSection } from "@/sections/projects";
import { TapeSection } from "@/sections/tape";
import { AboutSection } from "@/sections/about";
import { ExperienceSection } from "@/sections/experience";
import { InterviewSimulatorLazy } from "@/sections/interview/InterviewSimulatorLazy";
import { ContactSection } from "@/sections/contact";
import { TechNewsSection } from "@/sections/tech-news";
import { Footer } from "@/sections/footer";
import { SiteEnhancements } from "@/components/SiteEnhancements";

export default function Home() {
  return (
    <>
      <SiteEnhancements />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <TapeSection />
        <ExperienceSection />
        <InterviewSimulatorLazy />
        <TechNewsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}