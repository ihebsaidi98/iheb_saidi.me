export type AboutSkill = {
  name: string;
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
      { name: "Java / Spring Boot", note: "since 2019 · daily" },
      { name: "REST / Microservices", note: "event-driven lately" },
      { name: "PostgreSQL / Redis", note: "schemas & tuning" },
    ],
  },
  {
    label: "frontend",
    skills: [
      { name: "Angular / RxJS", note: "since 2020" },
      { name: "TypeScript", note: "strict mode, always" },
      { name: "Tailwind CSS", note: "design systems" },
    ],
  },
  {
    label: "ai & llm",
    skills: [
      { name: "Spring AI / LangChain4j", note: "prod RAG pipelines" },
      { name: "OpenAI / Anthropic APIs", note: "streaming · tools" },
      { name: "pgvector / embeddings", note: "semantic search" },
    ],
  },
  {
    label: "devops & cloud",
    skills: [
      { name: "Docker / CI-CD", note: "GitHub Actions" },
      { name: "AWS", note: "ECS · S3 · RDS" },
      { name: "Observability", note: "Grafana stack" },
    ],
  },
];