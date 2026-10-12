import { Header } from "@/sections/Header";
import { HeroSection } from "@/sections/Hero";
import { ProjectsSection } from "@/sections/Projects";
import { TapeSection } from "@/sections/Tape";
import { AboutSection } from "@/sections/About";
import { ExperienceSection } from "@/sections/Experience";
import { ContactSection } from "@/sections/Contact";
import { TechNewsSection } from "@/sections/TechNews";
import { Footer } from "@/sections/Footer";
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
        <TechNewsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}