export type ProjectMetric = {
  value: string;
  label: string;
};

export type Project = {
  slug: string;
  title: string;
  organization: string;
  period: string;
  role: string;
  description: string;
  tech: readonly string[];
  highlights: readonly string[];
  screenshot: string;
  category: "backend" | "fullstack" | "ai";
  metrics?: readonly ProjectMetric[];
  links?: { demo?: string; github?: string };
};

export const featuredProjects: readonly Project[] = [
  {
    slug: "novatek-platform",
    title: "Real-Time Industrial Supervision Platform",
    organization: "Novatek, Montplaisir",
    period: "Jul 2024 – Jan 2026", // ← fixed: matches experience.ts (was "Jul 2026")
    role: "Full Stack Engineer",
    description:
      "Architected and delivered a real-time industrial supervision platform covering L1–L3 traceability, production monitoring, energy consumption tracking, and anomaly alerting.",

    metrics: [
      { value: "30+", label: "secured APIs" },
      { value: "500+", label: "concurrent users" },
      { value: "40%", label: "faster API responses" }, // ← grammar fix (was "faster response")
      { value: "75%+", label: "test coverage" },
    ],

    highlights: [
      "30+ secured REST APIs with Spring Boot, sustaining 500+ concurrent users under production load",
      "Angular 14 dashboards with NgRx, RxJS and Chart.js for real-time industrial KPI visualization",
      "Dynamic PDF report generation engine using iText with reusable business template logic",
      "RBAC with Spring Security across a multi-tenant environment",
      "Optimized MySQL schema and query strategies, cutting average response time by 40%",
      "JUnit 5 / Mockito tests achieving 75%+ coverage with SonarQube quality gates",
      "Jenkins + Docker CI/CD pipelines automating builds, tests and deployments",
    ],

    tech: [
      "Java 17",
      "Spring Boot",
      "Angular 14",
      "NgRx",
      "RxJS",
      "MySQL",
      "iText",
      "Spring Security",
      "JUnit 5",
      "Mockito",
      "SonarQube",
      "Git",
      "Jira",
    ],

    screenshot: "novatek-platform.png",
    category: "fullstack",
  },

  {
    slug: "tunisair-itsm",
    title: "ITSM Platform with AI-Powered Document Analysis",
    organization: "Tunisair, Charguia",
    period: "Jan 2024 – Jul 2024",
    role: "Full Stack Developer · End-of-Studies Project",
    description:
      "Architected a full-scale ITSM platform with automated incident and problem workflow management, enhanced with AI-powered document analysis.",

    metrics: [
      { value: "42+", label: "secured APIs" },
      { value: "750+", label: "concurrent users" },
      { value: "48%", label: "faster API responses" },
      { value: "82%+", label: "test coverage" },
    ],

    highlights: [
      "Integrated Python / Flask + Ollama LLM for intelligent PDF document analysis",
      "Built complex Angular interfaces with FullCalendar, ngx-datatable and multi-step form wizards",
      "Configured Jenkins + Docker + SonarQube + Nexus CI/CD pipelines end-to-end",
      "Authored unit and integration tests covering state machine transitions and business logic",
      "Owned the full delivery lifecycle from analysis and design through development, testing and release",
    ],

    tech: [
      "Java 17",
      "Spring Boot",
      "Spring StateMachine",
      "Angular 14",
      "Python",
      "Flask",
      "Ollama LLM",
      "MySQL",
      "ITIL",
      "Swagger",
      "Scrum",
    ],

    screenshot: "tunisair-itsm.png",
    category: "fullstack",
  },

  {
    slug: "xtensus-client-management",
    title: "Client Management Dashboard",
    organization: "Xtensus, Ariana",
    period: "Jul 2023 – Aug 2023",
    role: "Full Stack Developer · Internship",
    description:
      "Delivered a client management dashboard for a kitchen manufacturing company.",

    highlights: [
      "Built REST backend services with Spring Boot",
      "Developed dynamic Angular interfaces powered by RxJS",
    ],

    tech: ["Java", "Spring Boot", "Angular", "TypeScript", "MySQL", "RxJS"],

    screenshot: "xtensus-client-management.png",
    category: "fullstack",
  },

  {
    slug: "world-soft-hotel",
    title: "Hotel Management Web Application",
    organization: "World Soft Group, Marsa",
    period: "Jul 2022 – Sep 2022",
    role: "Full Stack Developer · Internship",
    description:
      "Shipped a hotel management web application with real-time room availability tracking.",

    highlights: [
      "Developed REST APIs for hotel management workflows",
      "Implemented unit tests and functional validation for reservation workflows",
      "Built real-time room availability tracking",
    ],

    tech: ["Spring Boot", "Angular", "MySQL", "RxJS", "JavaScript"],

    screenshot: "world-soft-hotel.png",
    category: "fullstack",
  },

  {
    slug: "nlp-conversational-chatbot",
    title: "NLP Conversational Chatbot",
    organization: "ISIMS, Sfax",
    period: "Feb 2021 – Jun 2021",
    role: "Full Stack Developer · AI Project",
    description:
      "Designed an NLP-driven addiction-prevention conversational solution from scratch.",

    highlights: [
      "Engineered an intent classification model using PyTorch and NLTK",
      "Exposed the AI inference layer through a Flask REST API",
      "Built and integrated the web frontend with the AI inference layer",
    ],

    tech: [
      "Python",
      "Flask",
      "PyTorch",
      "NLTK",
      "NLP",
      "REST API",
      "JavaScript",
      "HTML5",
      "CSS3",
    ],

    screenshot: "nlp-conversational-chatbot.png",
    category: "ai",
  },
];

export const additionalProjects: readonly Project[] = [
  {
    slug: "auction-platform",
    title: "Real-Time Auction Platform",
    organization: "ESPRIT, Ariana",
    period: "Sep 2023 – Nov 2023",
    role: "Full Stack & DevOps",
    description:
      "Architected a distributed microservices auction platform using Spring Boot, Eureka and API Gateway.",

    metrics: [
      { value: "47+", label: "secured APIs" },
      { value: "900+", label: "concurrent users" },
      { value: "55%", label: "faster API responses" },
      { value: "88%+", label: "test coverage" },
    ],

    highlights: [
      "Designed a distributed microservices architecture",
      "Implemented automated CI/CD with Jenkins and Nexus",
      "Dockerized the full stack",
      "Enforced code quality with SonarQube",
      "Validated the system with JUnit 5 and Mockito",
    ],

    tech: [
      "Spring Boot",
      "Angular",
      "Microservices",
      "Eureka",
      "API Gateway",
      "Docker",
      "Jenkins",
      "SonarQube",
      "Nexus",
      "JUnit",
      "Mockito",
      "Git",
    ],

    screenshot: "auction-platform.png",
    category: "backend",
  },

  {
    slug: "medical-app",
    title: "Medical Sample Management Platform",
    organization: "Hôpital Charles Nicolle, Tunis",
    period: "Feb 2023 – May 2023",
    role: "Full Stack & Data Analytics",
    description:
      "Developed a medical sample management platform combining Angular, Spring Boot and Python/R data analytics modules.",

    metrics: [
      { value: "36+", label: "secured APIs" },
      { value: "650+", label: "concurrent users" },
      { value: "44%", label: "faster API responses" },
      { value: "79%+", label: "test coverage" },
    ],

    highlights: [
      "Developed the medical sample management platform",
      "Integrated Python and R data analytics modules",
      "Applied data mining techniques to the application",
    ],

    tech: ["Spring Boot", "Angular", "Python", "R", "MySQL", "Data Mining"],

    screenshot: "medical-app.png",
    category: "backend",
  },

  {
    slug: "fitness-platform",
    title: "Fitness Center Digitalization",
    organization: "ESPRIT, Ariana",
    period: "Jan 2022 – May 2022",
    role: "Full Stack Developer",
    description:
      "Designed and built a complete fitness center management and e-commerce platform with administration modules and an online store.",

    metrics: [
      { value: "33+", label: "secured APIs" },
      { value: "500+", label: "concurrent users" },
      { value: "40%", label: "faster API responses" },
      { value: "75%+", label: "test coverage" },
    ],

    highlights: [
      "Designed the full-stack architecture",
      "Built fitness center administration modules",
      "Developed an integrated online store",
    ],

    tech: [
      "Java",
      "JavaFX",
      "Symfony",
      "MySQL",
      "JavaScript",
      "TypeScript",
      "HTML5",
      "CSS3",
    ],

    screenshot: "fitness-platform.png",
    category: "fullstack",
  },
];