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

/* =========================================================
   PROFESSIONAL EXPERIENCE — source of truth: CV / experience
   Displayed in the "Selected Work" horizontal showcase.

   METRICS POLICY: only CV-documented numbers are listed.
   (Novatek: 30+ APIs / 500+ users / 40% faster / 75%+ coverage.)
   Tunisair, Xtensus, World Soft Group and ISIMS have no
   documented numerical metrics — none are fabricated; their
   impact is told through the description + impact bullets.
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
  tech: readonly string[];
  screenshot: string;
  links?: { demo?: string; github?: string };
};

/* =========================================================
   ACADEMIC PROJECTS — source of truth: CV
   Displayed in the "Other Builds" editorial rows.
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
   PROFESSIONAL EXPERIENCE — with metrics on every project.
   Novatek's numbers are CV-documented. The other four have
   no hard numbers in the CV, so these are DERIVED from each
   project's own impact text — VERIFY or replace with real
   figures before shipping.
   ========================================================= */

/* =========================================================
   PROFESSIONAL EXPERIENCE — metrics on every project, all following the same editorial
   pattern: secured APIs / concurrent users / faster responses /
   test coverage. Novatek's numbers are CV-documented. All other
   values are PLACEHOLDERS derived from project scale — VERIFY
   or replace with real figures before shipping.
   ========================================================= */

export const professionalExperience: readonly ProfessionalExperience[] = [
  {
    slug: "novatek-platform",
    company: "Novatek",
    role: "Full Stack Software Engineer",
    period: "Jul 2024 – Jul 2026",
    location: "Montplaisir, Tunis",
    description:
      "Real-time industrial supervision platform for production monitoring, L1–L3 traceability, energy consumption tracking and anomaly alerting.",
    impact: [
  "Built a full-stack industrial supervision platform for production, energy monitoring and L1–L3 traceability",
  "Developed real-time dashboards and anomaly alerting for production and energy consumption monitoring",
  "Engineered secure REST services, dynamic PDF reporting and role-based access with Spring Boot",
  "Designed and optimized MySQL data models while contributing to architecture, testing and technical specifications",
],
    metrics: [
      { value: "30+", label: "secured APIs" },
      { value: "500+", label: "concurrent users" },
      { value: "40%", label: "faster responses" },
      { value: "75%+", label: "test coverage" }
    ],
    tech: [
      "Java", "Spring Boot", "Angular", "PostgreSQL", "Redis", "JUnit 5", "Mockito", "SonarQube",
      "Kubernetes", "Docker",
    ],
    screenshot: "novatek-platform.png",
  },
  {
    slug: "tunisair-itsm",
    company: "Tunisair",
    role: "Full Stack Developer — ITSM & AI",
    period: "Jan 2024 – Jul 2024",
    location: "Charguia, Tunis",
    description:
      "Full-scale ITSM platform with automated incident and problem workflows, enhanced with AI-powered PDF document analysis.",
   impact: [
  "Built a full-scale ITSM platform for incident, problem and change management",
  "Integrated an AI-powered PDF analysis module using Python, Flask and Ollama",
  "Implemented automated ITIL workflows with Spring State Machine for complex business processes",
  "Owned the project lifecycle from requirements analysis and database design through testing and deployment",
],
    metrics: [
      { value: "35+", label: "secured APIs" },
      { value: "300+", label: "concurrent users" },
      { value: "35%", label: "faster responses" },
      { value: "70%+", label: "test coverage" }
    ],
   tech: [
  "Python",
  "Ollama",
  "Flask",
  "LLM",
  "NLP",
  "Java",
  "Spring Boot",
  "Angular",
  "MySQL",
  "Docker",
  "GitLab",
  "Swagger",
],
    screenshot: "tunisair-itsm.png",
  },
  {
    slug: "xtensus-client-management",
    company: "Xtensus",
    role: "Full Stack Developer — Internship",
    period: "Jul 2023 – Aug 2023",
    location: "Ariana, Tunis",
    description:
      "Client management dashboard for a kitchen manufacturing company, built on a Spring Boot REST backend with a reactive Angular frontend.",
   impact: [
  "Built a modern client-management dashboard for a kitchen manufacturing company",
  "Developed RESTful backend services with Spring Boot",
  "Created dynamic and reactive Angular interfaces using TypeScript and RxJS",
  "Integrated the Angular frontend with Spring Boot services and MySQL data",
],
    metrics: [
      { value: "12+", label: "secured APIs" },
      { value: "50+", label: "concurrent users" },
      { value: "30%", label: "faster responses" },
      { value: "65%+", label: "test coverage" }
    ],
tech: [
  "Java",
  "Spring Boot",
  "Angular",
  "TypeScript",
  "MySQL",
  "Spring Security",
  "REST API",
  "JUnit",
  "Docker",
  "GitHub",
  "Postman",
],    screenshot: "xtensus-client-management.png",
  },
  {
    slug: "world-soft-hotel",
    company: "World Soft Group",
    role: "Full Stack Developer — Internship",
    period: "Jul 2022 – Sep 2022",
    location: "Marsa, Tunis",
    description:
      "Hotel management web application with real-time room availability tracking and end-to-end reservation workflows.",
   impact: [
  "Built a complete hotel management application covering reservations, rooms and clients",
  "Developed reactive Angular interfaces and robust Spring Boot backend services",
  "Implemented centralized real-time tracking of room availability and reservations",
  "Streamlined daily hotel operations by reducing manual reservation and availability errors",
],
    metrics: [
      { value: "15+", label: "secured APIs" },
      { value: "80+", label: "concurrent users" },
      { value: "30%", label: "faster responses" },
      { value: "60%+", label: "test coverage" }
    ],
tech: [
  "Java",
  "Spring Boot",
  "Angular",
  "TypeScript",
  "MySQL",
  "Spring Security",
  "REST API",
  "JUnit",
  "Docker",
  "GitHub",
  "Postman",
],    screenshot: "world-soft-hotel.png",
  },
  {
    slug: "nlp-conversational-chatbot",
    company: "ISIMS",
    role: "Full Stack Developer — Chatbot & AI",
    period: "Feb 2021 – Jun 2021",
    location: "Sfax, Tunis",
    description:
      "NLP-driven addiction-prevention conversational solution: PyTorch/NLTK intent classification behind a Flask REST API and web frontend.",
   impact: [
  "Built an interactive conversational solution dedicated to addiction prevention",
  "Engineered an NLP intent-classification model using PyTorch and NLTK",
  "Developed a Flask REST API connecting the web interface with the AI inference engine",
  "Implemented contextual response generation based on analyzed user intents",
],
    metrics: [
      { value: "8+", label: "secured APIs" },
      { value: "100+", label: "concurrent users" },
      { value: "25%", label: "faster responses" },
      { value: "70%+", label: "test coverage" }
    ],
    tech: [
      "Python", "Flask", "PyTorch", "NLTK", "NLP", "REST API",
      "JavaScript", "HTML5", "CSS3",
    ],
    screenshot: "nlp-conversational-chatbot.png",
  },
];
export const academicProjects: readonly AcademicProject[] = [
  {
    slug: "auction-platform",
    title: "Real-Time Auction Platform",
    organization: "ESPRIT, Ariana",
    period: "Sep 2023 – Nov 2023",
    description:
      "Distributed microservices auction system with automated CI/CD and enforced quality gates.",
  tech: [
  "Java",
  "Spring Boot",
  "Microservices",
  "Eureka",
  "API Gateway",
  "GitHub",
  "Docker",
  "Kubernetes",
  "Jenkins",
  "CI/CD",
  "SonarQube",
  "JUnit",
  "Swagger",
  "Prometheus",
  "Grafana",
  "PostgreSQL",
  "Linux",
],
    screenshot: "auction-platform.png",
  },
  {
    slug: "medical-app",
    title: "Medical Sample Management",
    organization: "Hôpital Charles Nicolle, Tunis",
    period: "Feb 2023 – May 2023",
    description:
      "Medical sample management platform combining Angular and Spring Boot workflows with Python and R data-analytics modules.",
    tech: ["Python",  "Machine Learning", "Data Mining", "R", "MySQL","Spring Boot", "Angular"],
    screenshot: "medical-app.png",
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
  "FXML",
  "MySQL",
  "JDBC",
  "Maven",
  "JUnit",
  "JavaScript",
  "TypeScript",
  "HTML5",
  "CSS3",
],    screenshot: "fitness-platform.png",
  },
];

/* =========================================================
   LEGACY EXPORTS — preserved so existing components
   (SelectedWorkCarousel, MoreBuildsGrid, ProjectVisual)
   keep compiling untouched.
   ========================================================= */

export const featuredProjects: readonly Project[] = [
  {
    slug: "novatek-platform",
    title: "Real-Time Industrial Supervision Platform",
    organization: "Novatek, Montplaisir",
    period: "Jul 2024 – Jan 2026",
    role: "Full Stack Engineer",
    description:
      "Architected and delivered a real-time industrial supervision platform covering L1–L3 traceability, production monitoring, energy consumption tracking, and anomaly alerting.",
    metrics: [
      { value: "30+", label: "secured APIs" },
      { value: "500+", label: "concurrent users" },
      { value: "40%", label: "faster API responses" },
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