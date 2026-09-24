import { workPeriodsByOrganization } from "@/data/projects";

export type ExperienceEntry = {
  role: string;
  organization: string;
  period: string;
  details: readonly string[];
};

const EXPERIENCE_CONFIG = [
  {
    role: "Full Stack Engineer",
    organization: "Novatek (Délice Group)",
    details: [
      "Learned to design systems around real production constraints where reliability, performance and traceability matter every day",
      "Grew from implementing features to owning backend architecture, security decisions and database performance",
      "Learned how real-time interfaces change when users depend on live operational data rather than static business screens",
      "Developed a stronger engineering discipline around testing, observability, code quality and maintainable architecture",
    ],
  },
  {
    role: "Full Stack Developer",
    organization: "Tunisair",
    details: [
      "Learned to translate complex business processes into explicit, maintainable workflows instead of scattering business rules across the application",
      "Explored how AI can become part of an existing enterprise workflow rather than existing as an isolated feature",
      "Developed stronger ownership across requirements, architecture, implementation, testing and deployment",
      "Learned to work with enterprise systems where consistency, traceability and operational usability are equally important",
    ],
  },
  {
    role: "Full Stack Developer (Internship)",
    organization: "Xtensus, Ariana",
    details: [
      "Learned how a real business requirement becomes an end-to-end feature across database, API and frontend layers",
      "Strengthened my understanding of reactive frontend development with Angular, TypeScript and RxJS",
      "Discovered the importance of clean API contracts and clear separation between frontend and backend responsibilities",
    ],
  },
  {
    role: "Full Stack Developer (Internship)",
    organization: "World Soft Group, Marsa",
    details: [
      "Learned the fundamentals of building a complete web application around real operational workflows",
      "Gained my first practical experience connecting frontend interactions with backend business logic and persistent data",
      "Learned how small UX decisions can directly affect the efficiency of day-to-day users",
    ],
  },
  {
    role: "Full Stack Developer",
    organization: "ISIMS, Sfax — Bachelor's Final Project",
    details: [
      "Discovered how machine-learning concepts can be turned into a usable application rather than remaining a research experiment",
      "Learned to connect an NLP model, REST API and web interface into one complete user experience",
      "Built the foundation for my interest in combining software engineering with AI-driven applications",
    ],
  },
] as const;

export const experience: readonly ExperienceEntry[] = EXPERIENCE_CONFIG.map((job) => ({
  ...job,
  period: workPeriodsByOrganization[job.organization as keyof typeof workPeriodsByOrganization],
}));

/*
 * NOTE:
 * The canonical employment periods live in src/data/projects.ts, which is the
 * single source of truth for work dates. The timeline in this module derives its
 * period strings from that shared constant so dates are not duplicated again.
 */