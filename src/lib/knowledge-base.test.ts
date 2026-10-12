/**
 * src/lib/knowledge-base.test.ts
 *
 * Comprehensive tests for the portfolio knowledge base.
 *
 * Run with:  npm test
 * Or:        npx tsx --test src/lib/knowledge-base.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  portfolioKnowledgeBase,
  portfolioPublicDocuments,
  portfolioKnowledgeBaseByType,
  portfolioSearchText,
  validatePortfolioKnowledgeBase,
  getKnowledgeDocumentsByType,
  type KnowledgeDocument,
  type KnowledgeDocumentType,
} from "./knowledge-base.js";

import { SKILL_GROUPS } from "../data/about.js";
import { experience } from "../data/experience.js";
import { education } from "../data/education.js";
import { academicProjects, professionalExperience } from "../data/projects.js";
import { profile } from "../data/profile.js";

// ============================================================
// HELPERS
// ============================================================

function normalizeId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// INVARIANTS
// These must hold for every document in the knowledge base.
// ============================================================

describe("knowledge base — invariants", () => {
  const docs = portfolioKnowledgeBase.documents;

  it("contains at least 20 documents", () => {
    assert.ok(
      docs.length >= 20,
      `Expected at least 20 documents, got ${docs.length}`,
    );
  });

  it("has no duplicate document IDs", () => {
    const ids = docs.map((d) => d.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    assert.equal(
      duplicates.length,
      0,
      `Duplicate IDs found: ${duplicates.filter((id, i, arr) => arr.indexOf(id) === i).join(", ")}`,
    );
  });

  it("all documents pass the validation function", () => {
    const result = validatePortfolioKnowledgeBase(docs);
    assert.ok(
      result.valid,
      `Validation errors:\n${result.errors.map((e) => `  • ${e}`).join("\n")}`,
    );
  });

  it("every document has non-empty required string fields", () => {
    const required: Array<keyof KnowledgeDocument> = [
      "id",
      "type",
      "title",
      "summary",
      "content",
      "source",
    ];
    for (const doc of docs) {
      for (const field of required) {
        const value = doc[field];
        assert.ok(
          typeof value === "string" && value.trim().length > 0,
          `Document "${doc.id}" has empty or missing field: ${String(field)}`,
        );
      }
    }
  });

  it("every document has at least one tag", () => {
    for (const doc of docs) {
      assert.ok(
        Array.isArray(doc.tags) && doc.tags.length > 0,
        `Document "${doc.id}" has no tags`,
      );
    }
  });

  it("all document sources start with src/", () => {
    for (const doc of docs) {
      assert.ok(
        doc.source.startsWith("src/"),
        `Document "${doc.id}" has invalid source path: "${doc.source}"`,
      );
    }
  });

  it("all document types are valid", () => {
    const validTypes = new Set<KnowledgeDocumentType>([
      "profile",
      "skills",
      "experience",
      "education",
      "project",
      "contact",
      "meta",
    ]);
    for (const doc of docs) {
      assert.ok(
        validTypes.has(doc.type),
        `Document "${doc.id}" has invalid type: "${doc.type}"`,
      );
    }
  });

  it("every document has a boolean public field", () => {
    for (const doc of docs) {
      assert.equal(
        typeof doc.public,
        "boolean",
        `Document "${doc.id}" has non-boolean public field: ${String(doc.public)}`,
      );
    }
  });

  it("content is at least 20 characters on every document", () => {
    for (const doc of docs) {
      assert.ok(
        doc.content.trim().length >= 20,
        `Document "${doc.id}" content is too short (${doc.content.trim().length} chars)`,
      );
    }
  });

  it("summary is at least 10 characters on every document", () => {
    for (const doc of docs) {
      assert.ok(
        doc.summary.trim().length >= 10,
        `Document "${doc.id}" summary is too short (${doc.summary.trim().length} chars)`,
      );
    }
  });
});

// ============================================================
// COMPLETENESS
// Verifies that every portfolio data entry has a corresponding document.
// ============================================================

describe("knowledge base — completeness", () => {
  const docs = portfolioKnowledgeBase.documents;

  it("has a profile-overview document", () => {
    const found = docs.some((d) => d.id === "profile-overview");
    assert.ok(found, "Missing document: profile-overview");
  });

  it("has a contact-info document", () => {
    const found = docs.some((d) => d.id === "contact-info");
    assert.ok(found, "Missing document: contact-info");
  });

  it("has a skill document for every skill group", () => {
    for (const group of SKILL_GROUPS) {
      const found = docs.some(
        (d) =>
          d.type === "skills" &&
          (d.tags.includes(group.label) || d.id === `skills-${normalizeId(group.label)}`),
      );
      assert.ok(
        found,
        `Missing skills document for group: "${group.label}" (expected id: skills-${normalizeId(group.label)})`,
      );
    }
  });

  it("has an experience document for every experience entry", () => {
    for (const entry of experience) {
      const found = docs.some(
        (d) =>
          d.type === "experience" && d.metadata.company === entry.organization,
      );
      assert.ok(
        found,
        `Missing experience document for organisation: "${entry.organization}"`,
      );
    }
  });

  it("has a project document for every professional experience entry", () => {
    for (const entry of professionalExperience) {
      const found = docs.some((d) => d.id === `project-${entry.slug}`);
      assert.ok(
        found,
        `Missing professional project document for slug: "${entry.slug}"`,
      );
    }
  });

  it("has a project document for every academic project", () => {
    for (const entry of academicProjects) {
      const found = docs.some(
        (d) => d.id === `academic-project-${entry.slug}`,
      );
      assert.ok(
        found,
        `Missing academic project document for slug: "${entry.slug}"`,
      );
    }
  });

  it("has an education document for every education entry", () => {
    for (const entry of education) {
      const institution = entry.school ?? entry.institution ?? "Higher education";
      const found = docs.some(
        (d) =>
          d.type === "education" && d.metadata.school === institution,
      );
      assert.ok(
        found,
        `Missing education document for institution: "${institution}"`,
      );
    }
  });

  it("has a private meta-chatbot-rules document", () => {
    const found = docs.some((d) => d.id === "meta-chatbot-rules");
    assert.ok(found, "Missing document: meta-chatbot-rules");
  });

  it("total document count matches expected formula", () => {
    // profile (1) + contact (1) + skills (SKILL_GROUPS.length) +
    // experience (experience.length) + professional projects (professionalExperience.length) +
    // academic projects (academicProjects.length) + education (education.length) + meta (1)
    const expected =
      1 +
      1 +
      SKILL_GROUPS.length +
      experience.length +
      professionalExperience.length +
      academicProjects.length +
      education.length +
      1;
    assert.equal(
      docs.length,
      expected,
      `Expected ${expected} documents, got ${docs.length}`,
    );
  });
});

// ============================================================
// PRIVACY
// Public/private separation must be strictly maintained.
// ============================================================

describe("knowledge base — privacy", () => {
  it("meta documents have public: false", () => {
    const metaDocs = portfolioKnowledgeBase.documents.filter(
      (d) => d.type === "meta",
    );
    assert.ok(metaDocs.length > 0, "No meta documents found");
    for (const doc of metaDocs) {
      assert.equal(
        doc.public,
        false,
        `Meta document "${doc.id}" must have public: false`,
      );
    }
  });

  it("portfolioPublicDocuments contains no meta documents", () => {
    const metaInPublic = portfolioPublicDocuments.filter(
      (d) => d.type === "meta",
    );
    assert.equal(
      metaInPublic.length,
      0,
      `portfolioPublicDocuments must not include meta documents, found: ${metaInPublic.map((d) => d.id).join(", ")}`,
    );
  });

  it("portfolioPublicDocuments contains only public: true documents", () => {
    for (const doc of portfolioPublicDocuments) {
      assert.equal(
        doc.public,
        true,
        `portfolioPublicDocuments contains non-public document: "${doc.id}"`,
      );
    }
  });

  it("portfolioPublicDocuments is a strict subset of all documents", () => {
    const allIds = new Set(
      portfolioKnowledgeBase.documents.map((d) => d.id),
    );
    for (const doc of portfolioPublicDocuments) {
      assert.ok(
        allIds.has(doc.id),
        `Public document "${doc.id}" not found in full documents list`,
      );
    }
    assert.ok(
      portfolioPublicDocuments.length < portfolioKnowledgeBase.documents.length,
      "portfolioPublicDocuments should be smaller than the full list (private docs excluded)",
    );
  });
});

// ============================================================
// CONTENT QUALITY
// Spot-checks that key information is present in the right documents.
// ============================================================

describe("knowledge base — content quality", () => {
  it("profile document mentions the engineer's name", () => {
    const doc = portfolioKnowledgeBase.documents.find(
      (d) => d.id === "profile-overview",
    );
    assert.ok(doc, "profile-overview not found");
    assert.ok(
      doc.content.includes("Iheb"),
      "Profile content should include the name Iheb",
    );
  });

  it("profile document mentions the professional title", () => {
    const doc = portfolioKnowledgeBase.documents.find(
      (d) => d.id === "profile-overview",
    );
    assert.ok(doc, "profile-overview not found");
    // The title from profile.ts contains "Full Stack Software Engineer"
    assert.ok(
      doc.content.toLowerCase().includes("full stack") ||
        doc.content.toLowerCase().includes("full-stack"),
      "Profile content should mention full stack",
    );
  });

  it("contact document contains the email address", () => {
    const doc = portfolioKnowledgeBase.documents.find(
      (d) => d.id === "contact-info",
    );
    assert.ok(doc, "contact-info not found");
    assert.ok(
      doc.content.includes(profile.email),
      `Contact document should contain email: ${profile.email}`,
    );
  });

  it("contact document contains the LinkedIn URL", () => {
    const doc = portfolioKnowledgeBase.documents.find(
      (d) => d.id === "contact-info",
    );
    assert.ok(doc, "contact-info not found");
    assert.ok(
      doc.content.includes("linkedin"),
      "Contact document should contain LinkedIn",
    );
  });

  it("backend skills document mentions Java and Spring Boot", () => {
    const doc = portfolioKnowledgeBase.documents.find(
      (d) => d.id === "skills-backend",
    );
    assert.ok(doc, "skills-backend not found");
    assert.ok(
      doc.content.includes("Java") || doc.content.includes("Spring Boot"),
      "Backend skills should mention Java or Spring Boot",
    );
  });

  it("skills documents include the note/context for each skill", () => {
    const skillsWithNotes = SKILL_GROUPS.flatMap((g) =>
      g.skills.filter((s) => s.note),
    );
    for (const skill of skillsWithNotes.slice(0, 3)) {
      // sample check first 3
      const doc = portfolioKnowledgeBase.documents.find(
        (d) =>
          d.type === "skills" &&
          d.content.includes(skill.name) &&
          d.content.includes(skill.note!),
      );
      assert.ok(
        doc,
        `Skill "${skill.name}" with note "${skill.note}" not found in any skills document`,
      );
    }
  });

  it("experience documents contain role and company in content", () => {
    const expDocs = portfolioKnowledgeBase.documents.filter(
      (d) => d.type === "experience",
    );
    for (const doc of expDocs) {
      assert.ok(
        doc.metadata.role,
        `Experience doc "${doc.id}" missing role metadata`,
      );
      assert.ok(
        doc.metadata.company,
        `Experience doc "${doc.id}" missing company metadata`,
      );
      assert.ok(
        doc.content.includes(doc.metadata.role!),
        `Experience doc "${doc.id}" content should include the role`,
      );
      assert.ok(
        doc.content.includes(doc.metadata.company!),
        `Experience doc "${doc.id}" content should include the company name`,
      );
    }
  });

  it("experience documents include period metadata", () => {
    for (const doc of portfolioKnowledgeBaseByType.experience) {
      assert.ok(
        doc.metadata.period,
        `Experience doc "${doc.id}" missing period metadata`,
      );
    }
  });

  it("professional project documents include description", () => {
    for (const entry of professionalExperience) {
      const doc = portfolioKnowledgeBase.documents.find(
        (d) => d.id === `project-${entry.slug}`,
      );
      assert.ok(doc, `project-${entry.slug} not found`);
      assert.ok(
        doc.content.includes(entry.description.slice(0, 30)),
        `Project doc "${doc.id}" should include the description`,
      );
    }
  });

  it("academic project documents include the technology list", () => {
    const academicDocs = portfolioKnowledgeBase.documents.filter(
      (d) => d.type === "project" && d.id.startsWith("academic-project-"),
    );
    assert.ok(academicDocs.length > 0, "No academic project documents found");
    for (const doc of academicDocs) {
      assert.ok(
        Array.isArray(doc.metadata.technology) &&
          doc.metadata.technology.length > 0,
        `Academic project doc "${doc.id}" missing technology metadata`,
      );
      // The tech must appear in the content
      const firstTech = doc.metadata.technology![0];
      assert.ok(
        doc.content.includes(firstTech),
        `Academic project doc "${doc.id}" content should include technology: ${firstTech}`,
      );
    }
  });

  it("education documents include degree and institution", () => {
    for (const doc of portfolioKnowledgeBaseByType.education) {
      assert.ok(
        doc.content.includes("Degree:"),
        `Education doc "${doc.id}" should include degree label`,
      );
      assert.ok(
        doc.content.includes("Institution:"),
        `Education doc "${doc.id}" should include institution label`,
      );
      assert.ok(
        doc.metadata.period,
        `Education doc "${doc.id}" missing period metadata`,
      );
    }
  });

  it("professional project metrics appear in content when present", () => {
    for (const entry of professionalExperience) {
      if (!entry.metrics || entry.metrics.length === 0) continue;
      const doc = portfolioKnowledgeBase.documents.find(
        (d) => d.id === `project-${entry.slug}`,
      );
      assert.ok(doc, `project-${entry.slug} not found`);
      const firstMetric = entry.metrics[0];
      assert.ok(
        doc.content.includes(firstMetric.value),
        `Project doc "${doc.id}" should include metric value: ${firstMetric.value}`,
      );
    }
  });
});

// ============================================================
// VALIDATION FUNCTION — ERROR DETECTION
// Ensures the validator catches malformed documents.
// ============================================================

describe("validatePortfolioKnowledgeBase — error detection", () => {
  it("returns valid: true for the actual knowledge base", () => {
    const result = validatePortfolioKnowledgeBase();
    assert.equal(
      result.valid,
      true,
      `Validation failed: ${result.errors.join("; ")}`,
    );
    assert.equal(result.errors.length, 0);
  });

  it("returns valid: false for an empty array", () => {
    const result = validatePortfolioKnowledgeBase([]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0]?.includes("empty"));
  });

  it("detects a missing id", () => {
    const bad: KnowledgeDocument = {
      id: "",
      type: "profile",
      title: "Test Title",
      summary: "A test summary that is long enough",
      content: "Test content that is long enough for validation",
      source: "src/data/profile.ts",
      tags: ["test"],
      metadata: {},
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('"id"')),
      `Expected error about id, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects empty content", () => {
    const bad: KnowledgeDocument = {
      id: "test-doc-1",
      type: "profile",
      title: "Test Title",
      summary: "A test summary that is long enough",
      content: "",
      source: "src/data/profile.ts",
      tags: ["test"],
      metadata: {},
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('"content"')),
      `Expected error about content, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects content that is too short", () => {
    const bad: KnowledgeDocument = {
      id: "test-doc-2",
      type: "profile",
      title: "Test Title",
      summary: "A test summary",
      content: "Too short.",
      source: "src/data/profile.ts",
      tags: ["test"],
      metadata: {},
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("too short")),
      `Expected error about content length, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects empty tags array", () => {
    const bad: KnowledgeDocument = {
      id: "test-doc-3",
      type: "profile",
      title: "Test Title",
      summary: "A test summary that is long enough",
      content: "Test content that is long enough for validation purposes here",
      source: "src/data/profile.ts",
      tags: [],
      metadata: {},
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("tag")),
      `Expected error about tags, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects duplicate document IDs", () => {
    const base: KnowledgeDocument = {
      id: "duplicate-id-test",
      type: "profile",
      title: "Doc One",
      summary: "Summary for the first document that is long enough",
      content: "Content for the first document that is definitely long enough for validation",
      source: "src/data/profile.ts",
      tags: ["test"],
      metadata: {},
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([base, { ...base, title: "Doc Two" }]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.toLowerCase().includes("duplicate")),
      `Expected error about duplicates, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects a source path that does not start with src/", () => {
    const bad: KnowledgeDocument = {
      id: "test-doc-4",
      type: "profile",
      title: "Test Title",
      summary: "A test summary that is long enough",
      content: "Test content that is long enough for validation purposes here",
      source: "wrong/path/data.ts",
      tags: ["test"],
      metadata: {},
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("source")),
      `Expected error about source, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects a public meta document (privacy violation)", () => {
    const bad: KnowledgeDocument = {
      id: "meta-should-be-private",
      type: "meta",
      title: "Meta Test",
      summary: "Internal guidance summary that is long enough",
      content: "Internal guidance content that is definitely long enough for validation",
      source: "src/lib/knowledge-base.ts",
      tags: ["meta", "test"],
      metadata: {},
      public: true, // violation
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("meta")),
      `Expected error about meta privacy, got: ${result.errors.join("; ")}`,
    );
  });

  it("detects an experience document without role/company metadata", () => {
    const bad: KnowledgeDocument = {
      id: "experience-incomplete",
      type: "experience",
      title: "Some Role at Some Company",
      summary: "A test experience summary that is long enough",
      content: "Experience content that is definitely long enough for validation",
      source: "src/data/experience.ts",
      tags: ["experience"],
      metadata: {}, // missing role and company
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([bad]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes("experience")),
      `Expected error about experience metadata, got: ${result.errors.join("; ")}`,
    );
  });

  it("accepts a valid document without errors", () => {
    const good: KnowledgeDocument = {
      id: "valid-test-doc",
      type: "profile",
      title: "A Valid Document Title",
      summary: "A valid summary that is well over ten characters long",
      content:
        "A valid content section that is well over twenty characters long and covers the minimum requirements.",
      source: "src/data/profile.ts",
      tags: ["test", "valid"],
      metadata: { visibility: "public" },
      public: true,
    };
    const result = validatePortfolioKnowledgeBase([good]);
    assert.equal(result.valid, true, `Unexpected errors: ${result.errors.join("; ")}`);
    assert.equal(result.errors.length, 0);
  });
});

// ============================================================
// UTILITY EXPORTS
// ============================================================

describe("knowledge base — utility exports", () => {
  it("getKnowledgeDocumentsByType returns only matching documents", () => {
    const profileDocs = getKnowledgeDocumentsByType("profile");
    assert.ok(profileDocs.length > 0, "Should return at least one profile document");
    for (const doc of profileDocs) {
      assert.equal(doc.type, "profile", `Non-profile document in results: ${doc.id}`);
    }
  });

  it("getKnowledgeDocumentsByType returns correct count for experience", () => {
    const expDocs = getKnowledgeDocumentsByType("experience");
    assert.equal(
      expDocs.length,
      experience.length,
      `Expected ${experience.length} experience documents, got ${expDocs.length}`,
    );
  });

  it("portfolioKnowledgeBase has required top-level structure", () => {
    assert.equal(typeof portfolioKnowledgeBase.version, "number");
    assert.ok(portfolioKnowledgeBase.version >= 1);
    assert.ok(Array.isArray(portfolioKnowledgeBase.sourceFiles));
    assert.ok(portfolioKnowledgeBase.sourceFiles.length > 0);
    assert.ok(Array.isArray(portfolioKnowledgeBase.documents));
    assert.ok(portfolioKnowledgeBase.documents.length > 0);
  });

  it("portfolioKnowledgeBase source files all start with src/data/", () => {
    for (const path of portfolioKnowledgeBase.sourceFiles) {
      assert.ok(
        path.startsWith("src/data/") || path.startsWith("src/lib/"),
        `Source file path should start with src/: "${path}"`,
      );
    }
  });

  it("portfolioKnowledgeBaseByType has all expected category buckets", () => {
    const expected: KnowledgeDocumentType[] = [
      "profile",
      "contact",
      "skills",
      "experience",
      "education",
      "project",
      "meta",
    ];
    for (const bucket of expected) {
      assert.ok(
        bucket in portfolioKnowledgeBaseByType,
        `Missing bucket: ${bucket}`,
      );
    }
  });

  it("portfolioKnowledgeBaseByType buckets contain correctly typed documents", () => {
    for (const [type, docs] of Object.entries(portfolioKnowledgeBaseByType)) {
      for (const doc of docs as KnowledgeDocument[]) {
        assert.equal(
          doc.type,
          type,
          `Wrong type in "${type}" bucket: doc "${doc.id}" has type "${doc.type}"`,
        );
      }
    }
  });

  it("portfolioSearchText covers all public documents", () => {
    const searchIds = new Set(portfolioSearchText.map((s) => s.id));
    for (const doc of portfolioPublicDocuments) {
      assert.ok(
        searchIds.has(doc.id),
        `Public document "${doc.id}" is missing from portfolioSearchText`,
      );
    }
  });

  it("portfolioSearchText entries contain non-empty text", () => {
    for (const entry of portfolioSearchText) {
      assert.ok(entry.id.length > 0, "Search text entry has empty id");
      assert.ok(entry.text.length > 0, `Search text entry "${entry.id}" has empty text`);
      assert.ok(
        entry.text.includes(entry.id) || entry.text.length > 50,
        `Search text entry "${entry.id}" seems too short`,
      );
    }
  });
});
