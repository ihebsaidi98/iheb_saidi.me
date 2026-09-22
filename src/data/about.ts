export type AboutSkill = {
  name: string;
  level: number;
  note?: string;
};

export type SkillGroup = {
  label: string;
  skills: AboutSkill[];
};

export const SKILL_GROUPS: SkillGroup[] = [
  {
    label: "backend",
    skills: [
      { name: "Java / Spring Boot", level: 95, note: "since 2019 · daily" },
      { name: "REST / Microservices", level: 90, note: "event-driven lately" },
      { name: "PostgreSQL / Redis", level: 85, note: "schemas & tuning" },
    ],
  },
  {
    label: "frontend",
    skills: [
      { name: "Angular / RxJS", level: 90, note: "since 2020" },
      { name: "TypeScript", level: 88, note: "strict mode, always" },
      { name: "Tailwind CSS", level: 85, note: "design systems" },
    ],
  },
  {
    label: "ai & llm",
    skills: [
      { name: "Spring AI / LangChain4j", level: 80, note: "prod RAG pipelines" },
      { name: "OpenAI / Anthropic APIs", level: 82, note: "streaming · tools" },
      { name: "pgvector / embeddings", level: 78, note: "semantic search" },
    ],
  },
  {
    label: "devops & cloud",
    skills: [
      { name: "Docker / CI-CD", level: 82, note: "GitHub Actions" },
      { name: "AWS", level: 75, note: "ECS · S3 · RDS" },
      { name: "Observability", level: 70, note: "Grafana stack" },
    ],
  },
];
