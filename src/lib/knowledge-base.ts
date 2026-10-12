/**
 * src/lib/knowledge-base.ts
 *
 * Single source of truth for the portfolio knowledge base.
 * All content is derived from the actual data files in src/data/.
 * No content is invented here — everything is verified against
 * the canonical TypeScript data constants.
 *
 * STRUCTURE
 * ---------
 * Each KnowledgeDocument is a self-contained prose passage designed for:
 *   - Document chunking (via rag.ts chunkKnowledgeDocuments)
 *   - Embedding and semantic retrieval
 *   - Source attribution in chatbot answers
 *
 * PRIVACY
 * -------
 * Documents with `public: false` must NOT appear in retrieval results
 * returned to users. They are intended only for internal use (e.g., the
 * chatbot system prompt). Use `portfolioPublicDocuments` for RAG indexing.
 *
 * UPDATING
 * --------
 * 1. Edit the relevant file in src/data/ (e.g. src/data/experience.ts).
 * 2. The corresponding document below updates automatically at build time.
 * 3. For documents with hand-authored prose, update the template here too.
 * 4. Run `npm test` to verify no documents are malformed.
 */

import { SKILL_GROUPS } from "@/data/about";
import { education } from "@/data/education";
import { experience } from "@/data/experience";
import { profile } from "@/data/profile";
import { academicProjects, professionalExperience } from "@/data/projects";
import { availability, locationShort } from "@/data/site";

// ============================================================
// TYPES
// ============================================================

/**
 * Document categories. "contact" and "meta" are additions to the
 * original five types — they enable finer-grained retrieval scoping
 * and privacy control.
 */
export type KnowledgeDocumentType =
  | "profile"
  | "skills"
  | "experience"
  | "education"
  | "project"
  | "contact"
  | "meta";

export type KnowledgeDocument = {
  /** Stable unique identifier across all documents. */
  id: string;
  type: KnowledgeDocumentType;
  /** Short human-readable heading used in source attribution. */
  title: string;
  /** One-sentence summary for retrieval context snippets. */
  summary: string;
  /** Full prose passage to be chunked and embedded. */
  content: string;
  /** Relative file path of the authoritative data source (starts with src/). */
  source: string;
  /** Search tags for keyword-based pre-filtering. */
  tags: readonly string[];
  metadata: {
    company?: string;
    role?: string;
    school?: string;
    period?: string;
    location?: string;
    technology?: string[];
    visibility?: "public";
  };
  /**
   * When false, this document must NOT be returned as a retrieval result.
   * Use portfolioPublicDocuments (not portfolioKnowledgeBase.documents)
   * when building the RAG index.
   */
  public: boolean;
};

export type KnowledgeValidationResult = {
  valid: boolean;
  errors: string[];
};

// ============================================================
// PRIVATE HELPERS
// ============================================================

/** Convert any string to a lowercase, hyphenated slug. */
function normalizeId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Known technology keywords for accurate metadata extraction.
 * Matching is case-insensitive substring matching against impact/description text.
 * Only technologies that appear verbatim in the source text are extracted —
 * nothing is inferred or invented.
 */
const TECH_KEYWORDS: readonly string[] = [
  "Spring Boot",
  "Spring Security",
  "Spring State Machine",
  "Spring AI",
  "Angular 17",
  "Angular",
  "NgRx",
  "RxJS",
  "Chart.js",
  "TypeScript",
  "JavaScript",
  "Java",
  "Python",
  "Flask",
  "Ollama",
  "MySQL",
  "PostgreSQL",
  "Redis",
  "pgvector",
  "Docker",
  "Jenkins",
  "SonarQube",
  "Microservices",
  "Eureka",
  "API Gateway",
  "OpenAPI",
  "Resilience4j",
  "OWASP ZAP",
  "PyTorch",
  "NLTK",
  "LangChain4j",
  "JavaFX",
  "Symfony",
  "HTML5",
  "CSS3",
  "R",
  "AWS",
] as const;

/** Extract only technologies that are literally mentioned in the provided text strings. */
function extractTechFromText(texts: readonly string[]): string[] {
  const combined = texts.join(" ").toLowerCase();
  return TECH_KEYWORDS.filter((tech) => combined.includes(tech.toLowerCase()));
}

/** Format project metrics into a readable sentence. */
function formatMetrics(
  metrics?: readonly { value: string; label: string }[],
): string {
  if (!metrics || metrics.length === 0) return "";
  const formatted = metrics.map((m) => `${m.value} ${m.label}`).join("; ");
  return `Performance benchmarks: ${formatted}.`;
}

/**
 * Build the combined search text for a document.
 * Used by portfolioSearchText for full-text keyword search as a fallback.
 */
function buildDocumentText(document: {
  title: string;
  summary: string;
  content: string;
  tags: readonly string[];
}): string {
  return [
    `# ${document.title}`,
    document.summary,
    document.content,
    `Tags: ${document.tags.join(", ")}`,
  ].join("\n\n");
}

// ============================================================
// DOCUMENTS
// ============================================================

const portfolioDocuments: KnowledgeDocument[] = [
  // ----------------------------------------------------------
  // 1. PROFILE OVERVIEW
  // ----------------------------------------------------------
  {
    id: "profile-overview",
    type: "profile",
    title: "Iheb Saidi — Professional Profile",
    summary:
      "Full-stack software engineer based in Tunis, Tunisia, specialising in Java, Spring Boot, Angular, microservices, and AI-assisted workflows. Currently working at AgroRetail OS and open to new opportunities.",
    content: [
      `Iheb Saidi is a full-stack software engineer based in ${locationShort} (timezone: ${profile.timezone}).`,
      `His professional title is: ${profile.title}.`,
      ``,
      `He specialises in Java and Spring Boot backends, Angular and TypeScript frontends, event-driven microservices, production-grade REST APIs, and AI/LLM-assisted application workflows using Spring AI and pgvector.`,
      ``,
      `He is currently working at AgroRetail OS (since 2026) and is ${availability.toLowerCase()}.`,
      `He is open to relocation and typically responds to messages within 24 hours.`,
    ].join("\n"),
    source: "src/data/profile.ts",
    tags: [
      "profile",
      "full-stack",
      "java",
      "spring boot",
      "angular",
      "typescript",
      "tunis",
      "tunisia",
      "available",
    ],
    metadata: { visibility: "public", location: "Tunis, Tunisia" },
    public: true,
  },

  // ----------------------------------------------------------
  // 2. CONTACT INFORMATION
  // ----------------------------------------------------------
  {
    id: "contact-info",
    type: "contact",
    title: "Contact Information — Iheb Saidi",
    summary:
      "Public contact details for Iheb Saidi: email address, LinkedIn profile, GitHub profile, and CV download link.",
    content: [
      `Email: ${profile.email}`,
      `LinkedIn: ${profile.linkedin}`,
      `GitHub: ${profile.github}`,
      `CV / Résumé: ${profile.cv} (PDF download)`,
      `Location: Tunis, Tunisia`,
      `Timezone: Africa/Tunis (UTC+1)`,
      ``,
      `Iheb is ${availability.toLowerCase()} and is open to relocation.`,
    ].join("\n"),
    source: "src/data/profile.ts",
    tags: [
      "contact",
      "email",
      "linkedin",
      "github",
      "cv",
      "resume",
      "reach",
      "hire",
    ],
    metadata: { visibility: "public", location: "Tunis, Tunisia" },
    public: true,
  },

  // ----------------------------------------------------------
  // 3. SKILLS — one document per skill group for targeted retrieval
  // ----------------------------------------------------------
  ...SKILL_GROUPS.map((group) => {
    const groupSlug = normalizeId(group.label);
    return {
      id: `skills-${groupSlug}`,
      type: "skills" as const,
      title: `Technical Skills — ${group.label}`,
      summary: `Iheb's ${group.label} skills: ${group.skills.map((s) => s.name).join(", ")}.`,
      content: [
        `${group.label.toUpperCase()} SKILLS`,
        ``,
        group.skills
          .map((skill) =>
            skill.note ? `- ${skill.name} (${skill.note})` : `- ${skill.name}`,
          )
          .join("\n"),
      ].join("\n"),
      source: "src/data/about.ts",
      tags: [
        "skills",
        groupSlug,
        group.label,
        ...group.skills.map((s) => s.name.toLowerCase()),
      ],
      metadata: {
        visibility: "public" as const,
        technology: group.skills.map((s) => s.name),
      },
      public: true,
    };
  }),

  // ----------------------------------------------------------
  // 4. PROFESSIONAL EXPERIENCE — career perspective (experience.ts)
  //    Captures the role, growth story, and learning context.
  // ----------------------------------------------------------
  ...experience.map((entry) => ({
    id: `experience-${normalizeId(entry.organization)}`,
    type: "experience" as const,
    title: `${entry.role} at ${entry.organization} (${entry.period})`,
    summary: entry.details[0] ?? `${entry.role} at ${entry.organization}.`,
    content: [
      `Role: ${entry.role}`,
      `Company / Organisation: ${entry.organization}`,
      `Period: ${entry.period}`,
      ``,
      `Key contributions and learnings:`,
      entry.details.map((d) => `- ${d}`).join("\n"),
    ].join("\n"),
    source: "src/data/experience.ts",
    tags: [
      "experience",
      normalizeId(entry.organization),
      normalizeId(entry.role),
    ],
    metadata: {
      company: entry.organization,
      role: entry.role,
      period: entry.period,
      visibility: "public" as const,
    },
    public: true,
  })),

  // ----------------------------------------------------------
  // 5. PROFESSIONAL PROJECTS — technical detail (projects.ts)
  //    Captures what was built, measured, and which tech was used.
  // ----------------------------------------------------------
  ...professionalExperience.map((entry) => {
    const techInText = extractTechFromText(entry.impact);
    const metrics = formatMetrics(entry.metrics);
    return {
      id: `project-${entry.slug}`,
      type: "project" as const,
      title: `${entry.company} — ${entry.role} (${entry.period})`,
      summary: entry.description,
      content: [
        `Company: ${entry.company}`,
        `Role: ${entry.role}`,
        `Period: ${entry.period}`,
        `Location: ${entry.location}`,
        ``,
        `Description: ${entry.description}`,
        ``,
        `Technical contributions:`,
        entry.impact.map((item) => `- ${item}`).join("\n"),
        ...(metrics ? [``, metrics] : []),
        ...(techInText.length > 0
          ? [``, `Technologies mentioned: ${techInText.join(", ")}`]
          : []),
      ].join("\n"),
      source: "src/data/projects.ts",
      tags: [
        "project",
        "professional",
        normalizeId(entry.company),
        normalizeId(entry.role),
        entry.slug,
      ],
      metadata: {
        company: entry.company,
        role: entry.role,
        period: entry.period,
        location: entry.location,
        technology: techInText,
        visibility: "public" as const,
      },
      public: true,
    };
  }),

  // ----------------------------------------------------------
  // 6. ACADEMIC PROJECTS — uses the explicit tech[] array
  // ----------------------------------------------------------
  ...academicProjects.map((entry) => ({
    id: `academic-project-${entry.slug}`,
    type: "project" as const,
    title: `${entry.title} — ${entry.organization} (${entry.period})`,
    summary: entry.description,
    content: [
      `Project: ${entry.title}`,
      `Organisation: ${entry.organization}`,
      `Period: ${entry.period}`,
      ``,
      `Description: ${entry.description}`,
      ``,
      `Technologies: ${entry.tech.join(", ")}`,
    ].join("\n"),
    source: "src/data/projects.ts",
    tags: [
      "project",
      "academic",
      normalizeId(entry.organization),
      entry.slug,
      ...entry.tech.map((t) => t.toLowerCase()),
    ],
    metadata: {
      company: entry.organization,
      role: entry.title,
      period: entry.period,
      technology: [...entry.tech],
      visibility: "public" as const,
    },
    public: true,
  })),

  // ----------------------------------------------------------
  // 7. EDUCATION
  // ----------------------------------------------------------
  ...education.map((entry) => {
    const institution = entry.school ?? entry.institution ?? "Higher education";
    return {
      id: `education-${normalizeId(entry.degree)}`,
      type: "education" as const,
      title: `${entry.degree} — ${institution}`,
      summary: `${entry.degree} at ${institution} (${entry.period}).`,
      content: [
        `Degree: ${entry.degree}`,
        `Institution: ${institution}`,
        `Period: ${entry.period}`,
        ...(entry.description ? [`Description: ${entry.description}`] : []),
      ].join("\n"),
      source: "src/data/education.ts",
      tags: [
        "education",
        normalizeId(institution),
        normalizeId(entry.degree),
        entry.period,
      ],
      metadata: {
        school: institution,
        period: entry.period,
        visibility: "public" as const,
      },
      public: true,
    };
  }),

  // ----------------------------------------------------------
  // 8. META — CHATBOT RULES (PRIVATE)
  //    public: false — must NEVER appear in retrieval results.
  //    Used only to construct the chat API system prompt.
  // ----------------------------------------------------------
  {
    id: "meta-chatbot-rules",
    type: "meta",
    title: "Portfolio Chatbot — Scope and Guidelines",
    summary:
      "Internal guidance for the AI assistant: scope, tone, and privacy boundaries. Not for display to users.",
    content: [
      "PURPOSE",
      "This AI assistant is embedded on Iheb Saidi's portfolio website to help visitors learn about his professional background, skills, projects, and how to contact him.",
      "",
      "TOPICS TO ANSWER",
      "- Technical skills (Java, Spring Boot, Angular, TypeScript, microservices, AI/LLM, DevOps)",
      "- Professional work experience and employment history",
      "- Portfolio projects — both professional and academic",
      "- Education and academic background",
      "- Contact information (email, LinkedIn, GitHub, CV) — all are public",
      "- Availability and openness to new opportunities",
      "",
      "TOPICS TO DECLINE POLITELY",
      "- Salary expectations or compensation negotiation",
      "- Real-time scheduling or calendar availability",
      "- Personal opinions on political, social, or unrelated topics",
      "- Anything not covered by the provided portfolio context",
      "",
      "TONE AND FORMAT",
      "Be concise, professional, and factual. Refer to Iheb in the third person.",
      "Do not fabricate, infer, or embellish information beyond what is provided in the context chunks.",
      "When the context does not contain a sufficient answer, say so honestly.",
      "Keep responses short unless detail is explicitly requested.",
    ].join("\n"),
    source: "src/lib/knowledge-base.ts",
    tags: ["meta", "chatbot", "rules", "system", "internal"],
    metadata: {},
    public: false,
  },
];

// ============================================================
// EXPORTS — PRIMARY
// ============================================================

export const portfolioKnowledgeBase = {
  /** Increment when the schema changes in a breaking way. */
  version: 2,
  sourceFiles: [
    "src/data/profile.ts",
    "src/data/site.ts",
    "src/data/about.ts",
    "src/data/experience.ts",
    "src/data/education.ts",
    "src/data/projects.ts",
  ],
  /** ALL documents, including private ones. Do NOT use for RAG indexing. */
  documents: portfolioDocuments,
};

/**
 * The subset of documents safe to index for vector search and return to users.
 * Use this (not portfolioKnowledgeBase.documents) when building the RAG index.
 */
export const portfolioPublicDocuments = portfolioDocuments.filter(
  (d) => d.public === true,
);

/** Pre-built combined search text for each public document (id + full text). */
export const portfolioSearchText = portfolioDocuments
  .filter((d) => d.public === true)
  .map((document) => ({
    id: document.id,
    text: buildDocumentText(document),
  }));

/** Documents grouped by type for structured access. */
export const portfolioKnowledgeBaseByType = {
  profile: portfolioDocuments.filter((d) => d.type === "profile"),
  contact: portfolioDocuments.filter((d) => d.type === "contact"),
  skills: portfolioDocuments.filter((d) => d.type === "skills"),
  experience: portfolioDocuments.filter((d) => d.type === "experience"),
  education: portfolioDocuments.filter((d) => d.type === "education"),
  project: portfolioDocuments.filter((d) => d.type === "project"),
  meta: portfolioDocuments.filter((d) => d.type === "meta"),
};

// ============================================================
// EXPORTS — UTILITY
// ============================================================

export function getKnowledgeDocumentsByType(
  type: KnowledgeDocumentType,
): KnowledgeDocument[] {
  return portfolioDocuments.filter((d) => d.type === type);
}

// ============================================================
// VALIDATION
// ============================================================

const VALID_TYPES: readonly KnowledgeDocumentType[] = [
  "profile",
  "skills",
  "experience",
  "education",
  "project",
  "contact",
  "meta",
];

const MIN_CONTENT_LENGTH = 20;
const MIN_SUMMARY_LENGTH = 10;

export function validatePortfolioKnowledgeBase(
  documents: readonly KnowledgeDocument[] = portfolioKnowledgeBase.documents as readonly KnowledgeDocument[],
): KnowledgeValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(documents) || documents.length === 0) {
    return {
      valid: false,
      errors: ["Knowledge base documents array is empty or missing."],
    };
  }

  // ---- Duplicate ID detection ----
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  for (const doc of documents) {
    if (doc.id && seenIds.has(doc.id)) {
      duplicateIds.push(doc.id);
    }
    if (doc.id) seenIds.add(doc.id);
  }
  if (duplicateIds.length > 0) {
    const unique = duplicateIds.filter(
      (id, i, arr) => arr.indexOf(id) === i,
    );
    errors.push(`Duplicate document IDs found: ${unique.join(", ")}.`);
  }

  // ---- Per-document validation ----
  documents.forEach((document, index) => {
    const label = `Document ${index + 1} (${document.id || "unknown id"})`;

    // Required string fields
    const requiredStringFields: Array<[keyof KnowledgeDocument, string]> = [
      ["id", "id"],
      ["type", "type"],
      ["title", "title"],
      ["summary", "summary"],
      ["content", "content"],
      ["source", "source"],
    ];

    for (const [key, displayLabel] of requiredStringFields) {
      const value = document[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`${label}: missing or empty "${displayLabel}".`);
      }
    }

    // Valid document type
    if (document.type && !VALID_TYPES.includes(document.type)) {
      errors.push(
        `${label}: invalid type "${document.type}". Expected one of: ${VALID_TYPES.join(", ")}.`,
      );
    }

    // Content and summary length minimums
    if (
      document.content &&
      document.content.trim().length < MIN_CONTENT_LENGTH
    ) {
      errors.push(
        `${label}: content is too short (minimum ${MIN_CONTENT_LENGTH} characters; found ${document.content.trim().length}).`,
      );
    }

    if (
      document.summary &&
      document.summary.trim().length < MIN_SUMMARY_LENGTH
    ) {
      errors.push(
        `${label}: summary is too short (minimum ${MIN_SUMMARY_LENGTH} characters; found ${document.summary.trim().length}).`,
      );
    }

    // Tags
    if (!document.tags || document.tags.length === 0) {
      errors.push(`${label}: must include at least one tag.`);
    }

    // Source path
    if (document.source && !document.source.startsWith("src/")) {
      errors.push(
        `${label}: source must start with "src/". Got: "${document.source}".`,
      );
    }

    // Public field is a boolean
    if (typeof document.public !== "boolean") {
      errors.push(`${label}: "public" field must be a boolean.`);
    }

    // Privacy: meta documents must not be public
    if (document.type === "meta" && document.public === true) {
      errors.push(
        `${label}: meta documents must have public: false to prevent leaking internal rules to users.`,
      );
    }

    // Type-specific metadata requirements
    if (
      document.type === "experience" &&
      (!document.metadata?.role || !document.metadata?.company)
    ) {
      errors.push(
        `${label}: experience documents must include role and company in metadata.`,
      );
    }

    if (
      document.type === "education" &&
      !document.metadata?.school &&
      !document.metadata?.period
    ) {
      errors.push(
        `${label}: education documents must include school or period in metadata.`,
      );
    }

    if (
      document.type === "project" &&
      !document.metadata?.company &&
      !document.metadata?.role
    ) {
      errors.push(
        `${label}: project documents must include company or role in metadata.`,
      );
    }
  });

  return { valid: errors.length === 0, errors };
}

// ============================================================
// MODULE-LEVEL VALIDATION GUARD
// Fails loudly at import time if the knowledge base is malformed.
// Surfaces data issues during `npm run build` and `npm test`.
// ============================================================

export const portfolioKnowledgeValidation = validatePortfolioKnowledgeBase();

if (!portfolioKnowledgeValidation.valid) {
  throw new Error(
    `Portfolio knowledge base validation failed:\n${portfolioKnowledgeValidation.errors
      .map((e) => `  • ${e}`)
      .join("\n")}`,
  );
}
