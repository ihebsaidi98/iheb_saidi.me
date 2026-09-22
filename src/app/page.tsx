import { Header } from "@/sections/Header";
import { HeroSection } from "@/sections/Hero";
import { ProjectsSection } from "@/sections/Projects";
import { TapeSection } from "@/sections/Tape";
import { AboutSection } from "@/sections/About";
import { ExperienceSection } from "@/sections/Experience";
import { EducationSection } from "@/sections/Education";
import { ContactSection } from "@/sections/Contact";
import { Footer } from "@/sections/Footer";
import { SiteEnhancements } from "@/components/SiteEnhancements";

export default function Home() {
  return (
    <>
      <SiteEnhancements />
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <TapeSection />
        <ExperienceSection />
        <EducationSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}