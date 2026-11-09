import dynamic from "next/dynamic";
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

function InterviewSimulatorSkeleton() {
  return (
    <section
      id="interview"
      className="py-24 md:py-32"
      aria-label="Loading Technical Interview Simulator"
    >
      <div className="container mx-auto px-5 sm:px-8 md:px-10">
        <div className="mx-auto max-w-4xl min-h-[460px] rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 animate-pulse" />
      </div>
    </section>
  );
}

const InterviewSimulatorSection = dynamic(
  () =>
    import("@/sections/InterviewSimulator").then(
      (mod) => mod.InterviewSimulatorSection
    ),
  {
    loading: () => <InterviewSimulatorSkeleton />,
  }
);

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
        <InterviewSimulatorSection />
        <TechNewsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}