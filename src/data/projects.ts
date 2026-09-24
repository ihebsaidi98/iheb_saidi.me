export type ProjectMetric = {
  value: string;
  label: string;
};

/* =========================================================
   PROFESSIONAL EXPERIENCE
   ---------------------------------------------------------
   Source of truth for the Selected Work case-study deck.
   ========================================================= */

export type ProfessionalExperience = {
  slug: string;
  company: string;
  role: string;
  period: string;
  location: string;
  description: string;
  impact: readonly string[];
  metrics?: readonly ProjectMetric[];
  screenshot: string;
  links?: {
    demo?: string;
    github?: string;
  };
};

/* =========================================================
   ACADEMIC PROJECTS
   ========================================================= */

export type AcademicProject = {
  slug: string;
  title: string;
  organization: string;
  period: string;
  description: string;
  tech: readonly string[];
  screenshot: string;
  link?: string;
};

/* =========================================================
   PROFESSIONAL EXPERIENCE
   ========================================================= */

export const professionalExperience: readonly ProfessionalExperience[] = [
  /* =========================================================
     01 — AGRORETAIL OS
     ========================================================= */

  {
    slug: "agroretail-os",
    company: "AgroRetail OS",
    role: "Multi-tenant SaaS for Agricultural Retail",
    period: "2026 – Present",
    location: "Tunis, Tunisia",

    description:
      "connecting cooperatives, cashiers and farmers through secure POS, B2B and farmer-facing workflows.",

    impact: [
      "Engineered a multi-tenant SaaS platform with tenant-isolated data, role-based access and secure workflows for cooperatives, cashiers and farmers",
      "Built the Angular 17 Farmer Portal and POS experiences with secure authentication, responsive dashboards and offline-first transaction handling",
      "Implemented regulatory and document workflows including Certiphyto validation, asynchronous DRE generation and transactional Outbox processing",
      "Hardened the platform for production with OpenAPI APIs, API-key security, Resilience4j, observability, load testing and OWASP ZAP security auditing",
    ],

    metrics: [
      {
        value: "50",
        label: "concurrent cashiers — load test",
      },
      {
        value: "1000",
        label: "sales/min — load test",
      },
      {
        value: "100",
        label: "ms product search target",
      },
      {
        value: "500",
        label: "ms dashboard target",
      },
    ],

    screenshot: "agroretail-os.webp",
  },

  /* =========================================================
     02 — NOVATEK
     ========================================================= */

  {
    slug: "novatek-platform",
    company: "Novatek",
    role: "Real-Time Industrial Supervision Platform",
    period: "Jul 2024 – Jan 2026",
    location: "Montplaisir, Tunis",

    description:
      "Manage production monitoring, L1–L3 traceability, energy consumption tracking and anomaly alerting.",

    impact: [
      "Engineered 30+ secured REST APIs with Spring Boot and Spring Security for production workflows and L1–L3 traceability",
      "Built real-time Angular dashboards with NgRx, RxJS and Chart.js for production KPIs and anomaly monitoring",
      "Designed dynamic PDF reporting and role-based access across a multi-tenant industrial platform",
      "Optimized MySQL schemas and queries, reducing average response time by 40%",
    ],

    metrics: [
      {
        value: "30+",
        label: "secured APIs",
      },
      {
        value: "500+",
        label: "concurrent users",
      },
      {
        value: "40%",
        label: "faster responses",
      },
      {
        value: "75%+",
        label: "test coverage",
      },
    ],

    screenshot: "novatek-platform.webp",
  },

  /* =========================================================
     03 — TUNISAIR
     ========================================================= */

  {
    slug: "tunisair-itsm",
    company: "Tunisair",
    role: "ITSM & AI Platform",
    period: "Jan 2024 – Jul 2024",
    location: "Charguia, Tunis",

    description:
      "Full-scale ITSM platform with automated incident and problem workflows, enhanced with AI-powered PDF document analysis.",

    impact: [
      "Built an enterprise ITSM platform covering incident, problem and change management workflows",
      "Integrated AI-powered PDF document analysis using Python, Flask and Ollama",
      "Implemented automated ITIL workflows with Spring State Machine for complex business processes",
      "Owned delivery from requirements analysis and database design through testing and deployment",
    ],

    metrics: [
      {
        value: "35+",
        label: "secured APIs",
      },
      {
        value: "300+",
        label: "concurrent users",
      },
      {
        value: "35%",
        label: "faster responses",
      },
      {
        value: "70%+",
        label: "test coverage",
      },
    ],

    screenshot: "tunisair-itsm.webp",
  },

  /* =========================================================
     04 — XTENSUS
     ========================================================= */

  {
    slug: "xtensus-client-management",
    company: "Xtensus",
    role: "Client Management Platform",
    period: "Jul 2023 – Aug 2023",
    location: "Ariana, Tunis",

    description:
      "Client management dashboard for a kitchen manufacturing company, built on a Spring Boot REST backend with a reactive Angular frontend.",

    impact: [
      "Built a client-management dashboard supporting customer and business workflows",
      "Developed RESTful backend services with Spring Boot",
      "Created dynamic reactive interfaces with Angular, TypeScript and RxJS",
      "Integrated the frontend with Spring Boot services and MySQL data",
    ],

    metrics: [
      {
        value: "12+",
        label: "secured APIs",
      },
      {
        value: "50+",
        label: "concurrent users",
      },
      {
        value: "30%",
        label: "faster responses",
      },
      {
        value: "65%+",
        label: "test coverage",
      },
    ],

    screenshot: "xtensus-client-management.webp",
  },

  /* =========================================================
     05 — WORLD SOFT GROUP
     ========================================================= */

  {
    slug: "world-soft-hotel",
    company: "World Soft Group",
    role: "Hotel Management Platform",
    period: "Jul 2022 – Sep 2022",
    location: "Marsa, Tunis",

    description:
      "Hotel management web application with real-time room availability tracking and end-to-end reservation workflows.",

    impact: [
      "Built a hotel management application covering reservations, rooms and client workflows",
      "Developed reactive Angular interfaces and Spring Boot backend services",
      "Implemented centralized tracking of room availability and reservations",
      "Streamlined reservation workflows to reduce manual availability errors",
    ],

    metrics: [
      {
        value: "15+",
        label: "secured APIs",
      },
      {
        value: "80+",
        label: "concurrent users",
      },
      {
        value: "30%",
        label: "faster responses",
      },
      {
        value: "60%+",
        label: "test coverage",
      },
    ],

    screenshot: "world-soft-hotel.webp",
  },

  /* =========================================================
     06 — ISIMS
     ========================================================= */

  {
    slug: "nlp-conversational-chatbot",
    company: "ISIMS",
    role: "NLP Conversational Chatbot",
    period: "Feb 2021 – Jun 2021",
    location: "Sfax, Tunisia",

    description:
      "NLP-driven addiction-prevention conversational solution: PyTorch/NLTK intent classification behind a Flask REST API and web frontend.",

    impact: [
      "Built an interactive conversational solution dedicated to addiction prevention",
      "Engineered an NLP intent-classification model using PyTorch and NLTK",
      "Developed a Flask REST API connecting the web interface with the AI inference engine",
      "Implemented contextual response generation based on analyzed user intents",
    ],

    metrics: [
      {
        value: "8+",
        label: "secured APIs",
      },
      {
        value: "100+",
        label: "concurrent users",
      },
      {
        value: "25%",
        label: "faster responses",
      },
      {
        value: "70%+",
        label: "test coverage",
      },
    ],

    screenshot: "nlp-conversational-chatbot.webp",
  },
];

/* =========================================================
   ACADEMIC PROJECTS
   ========================================================= */

export const workPeriodsByOrganization = {
  "AgroRetail OS": "2026 – Present",
  "Novatek (Délice Group)": "Jul 2024 – Jan 2026",
  Tunisair: "Jan 2024 – Jul 2024",
  "Xtensus, Ariana": "Jul 2023 – Aug 2023",
  "World Soft Group, Marsa": "Jul 2022 – Sep 2022",
  "ISIMS, Sfax — Bachelor's Final Project": "Feb 2021 – Jun 2021",
} as const;

export const academicProjects: readonly AcademicProject[] = [
  {
    slug: "auction-platform",
    title: "Real-Time Auction Platform",
    organization: "ESPRIT, Ariana",
    period: "Sep 2023 – Nov 2023",

    description:
      "Distributed microservices auction system with automated CI/CD and enforced quality gates.",

    tech: [
      "Spring Boot",
      "Angular",
      "Microservices",
      "Eureka",
      "API Gateway",
      "Docker",
      "Jenkins",
      "SonarQube",
    ],

    screenshot: "auction-platform.webp",
  },

  {
    slug: "medical-app",
    title: "Medical Sample Management",
    organization: "Hôpital Charles Nicolle, Tunis",
    period: "Feb 2023 – May 2023",

    description:
      "Medical sample management platform combining Angular and Spring Boot workflows with Python and R data-analytics modules.",

    tech: [
      "Spring Boot",
      "Angular",
      "Python",
      "R",
      "MySQL",
      "Data Mining",
    ],

    screenshot: "medical-app.webp",
  },

  {
    slug: "fitness-platform",
    title: "Fitness Center Digitalization",
    organization: "ESPRIT, Ariana",
    period: "Jan 2022 – May 2022",

    description:
      "Full-stack fitness center management and e-commerce platform covering administration modules and an online store.",

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

    screenshot: "fitness-platform.webp",
  },
];

/* =========================================================
   LEGACY EXPORTS
   ========================================================= */

// `featuredProjects` and `additionalProjects` intentionally remain
// removed. `professionalExperience` and `academicProjects` are the
// single sources of truth.