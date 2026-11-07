/**
 * src/lib/doc-consistency.test.ts
 *
 * AUD-14 — documentation drift guard.
 *
 * These tests do not exercise runtime code. They compare what the two READMEs
 * *claim* with the files that own the truth (`package.json`, `pyproject.toml`,
 * the FastAPI routers). The defect being fixed is exactly this drift:
 *
 *   - `README.md` advertised "Next.js 14" and "React 18" while the project runs
 *     Next.js 15 and React 19.
 *   - `ai-service/README.md` described Phase 2 and Phase 3 as "Upcoming" after
 *     both had shipped, documented the wrong `session_token` handling for the
 *     interview endpoints, and never mentioned `POST /v1/interview/complete`.
 *
 * Only stable anchors are asserted: a `- Next.js <major>` list item, a
 * `Python <x.y>+` prerequisite, literal endpoint paths, and `npm run <script>`
 * invocations. No prose matching.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/doc-consistency.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { portfolioPublicDocuments } from "./knowledge-base";
import { chunkKnowledgeDocuments, CURRENT_STRATEGY_VERSION } from "./rag";

const ROOT = process.cwd();

function readFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Major version of a semver range such as "^15.5.28". */
function majorOf(range: string): string {
  const match = range.match(/(\d+)\./);
  assert.ok(match, `unparsable version range: ${range}`);
  return match[1];
}

const README = readFile("README.md");
const AI_README = readFile("ai-service/README.md");
const PKG = JSON.parse(readFile("package.json")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
};

describe("AUD-14 — the documented stack matches package.json", () => {
  it("advertises the Next.js major version the project actually runs", () => {
    const documented = README.match(/^- Next\.js (\d+)/m);
    assert.ok(documented, "README.md must list the Next.js version in its Stack section");
    assert.equal(documented[1], majorOf(PKG.dependencies["next"]!));
  });

  it("advertises the React major version the project actually runs", () => {
    const documented = README.match(/^- React (\d+)/m);
    assert.ok(documented, "README.md must list the React version in its Stack section");
    assert.equal(documented[1], majorOf(PKG.dependencies["react"]!));
  });

  it("documents the same Python requirement as pyproject.toml", () => {
    const pyproject = readFile("ai-service/pyproject.toml");
    const required = pyproject.match(/requires-python\s*=\s*">=(\d+\.\d+)"/);
    assert.ok(required, "pyproject.toml must pin requires-python");
    const documented = AI_README.match(/Python (\d+\.\d+)\+/);
    assert.ok(documented, "ai-service/README.md must state the Python prerequisite");
    assert.equal(documented[1], required[1]);
  });
});

describe("AUD-14 — the documented API inventory matches the routers", () => {
  // Source of truth: app/api/v1/*.py (prefix) and app/api/health.py.
  const ENDPOINTS = [
    "/health/live",
    "/health/ready",
    "/v1/info",
    "/v1/rag/search",
    "/v1/rag/chat",
    "/v1/agent/answer",
    "/v1/copilot/match-job",
    "/v1/copilot/project-deep-dive",
    "/v1/interview/start",
    "/v1/interview/submit-answer",
    "/v1/interview/complete",
  ];

  it("documents every endpoint the service exposes", () => {
    const missing = ENDPOINTS.filter((endpoint) => !AI_README.includes(endpoint));
    assert.deepEqual(missing, [], `ai-service/README.md does not document: ${missing.join(", ")}`);
  });

  it("documents the session token required by the interview endpoints", () => {
    // The token is the only credential those endpoints accept; a reader who
    // follows a doc without it gets a 422 on every call after /start.
    const start = AI_README.slice(
      AI_README.indexOf("`POST /v1/interview/start`"),
      AI_README.indexOf("`POST /v1/interview/submit-answer`"),
    );
    assert.ok(start.includes("session_token"), "/v1/interview/start must be documented as returning session_token");

    const submit = AI_README.slice(
      AI_README.indexOf("`POST /v1/interview/submit-answer`"),
      AI_README.indexOf("`POST /v1/interview/complete`"),
    );
    assert.ok(submit.includes("session_token"), "/v1/interview/submit-answer must be documented as taking session_token");
  });
});

describe("AUD-14 — every documented npm script exists", () => {
  it("only references scripts declared in package.json", () => {
    const documented = new Set<string>();
    for (const text of [README, AI_README]) {
      for (const match of text.matchAll(/npm run ([a-z][\w:-]*)/g)) {
        documented.add(match[1]!);
      }
    }
    assert.ok(documented.size > 0, "the READMEs must document at least one npm script");
    for (const script of documented) {
      assert.ok(
        Object.hasOwn(PKG.scripts, script),
        `documented "npm run ${script}" does not exist in package.json`,
      );
    }
  });
});

describe("AUD-14 — RAG index drift guard (rag-index.json vs portfolioPublicDocuments)", () => {
  const index = JSON.parse(readFile("src/data/rag-index.json")) as {
    version: number;
    strategyVersion: number;
    model: string;
    dimensions: number;
    recordsCount: number;
    records: Array<{
      id: string;
      documentId: string;
      type: string;
      title: string;
      summary?: string;
      source?: string;
      text: string;
      searchText?: string;
      tags?: string[];
      metadata: Record<string, unknown>;
      vector: number[];
    }>;
  };
  const chunks = chunkKnowledgeDocuments(portfolioPublicDocuments);

  it("maintains expected index header metadata and dimensions", () => {
    assert.equal(index.version, 1, "index format version must be 1");
    assert.equal(
      index.strategyVersion,
      CURRENT_STRATEGY_VERSION,
      "strategyVersion must match CURRENT_STRATEGY_VERSION",
    );
    assert.equal(index.model, "gemini-embedding-001", "model must be gemini-embedding-001");
    assert.equal(index.dimensions, 768, "dimensions must be 768");
    assert.equal(index.recordsCount, chunks.length, "recordsCount header must match chunk count");
    assert.equal(index.records.length, chunks.length, "actual records array length must match chunk count");
  });

  it("contains an exact 1:1 correspondence of chunk IDs between corpus and index", () => {
    const chunkIds = new Set(chunks.map((c) => c.id));
    const recordIds = new Set(index.records.map((r) => r.id));

    assert.equal(chunkIds.size, chunks.length, "chunk IDs must be unique");
    assert.equal(recordIds.size, index.records.length, "record IDs in index must be unique");
    assert.deepEqual(
      Array.from(recordIds).sort(),
      Array.from(chunkIds).sort(),
      "index records must have exactly the same IDs as corpus chunks",
    );
  });

  it("preserves exact text, searchText, tags, and document metadata for every chunk without drift", () => {
    const recordMap = new Map(index.records.map((r) => [r.id, r]));

    for (const chunk of chunks) {
      const record = recordMap.get(chunk.id);
      assert.ok(record, `chunk ${chunk.id} must exist in index`);
      assert.equal(record.text, chunk.text, `text drift detected in chunk ${chunk.id}`);
      assert.equal(record.searchText, chunk.searchText, `searchText drift detected in chunk ${chunk.id}`);
      assert.equal(record.title, chunk.title, `title drift detected in chunk ${chunk.id}`);
      assert.equal(record.type, chunk.type, `type drift detected in chunk ${chunk.id}`);
      assert.equal(record.documentId, chunk.documentId, `documentId drift detected in chunk ${chunk.id}`);
      assert.deepEqual(record.tags, chunk.tags, `tags drift detected in chunk ${chunk.id}`);
      assert.deepEqual(record.metadata, chunk.metadata, `metadata drift detected in chunk ${chunk.id}`);
      assert.equal(record.vector.length, 768, `vector dimension must be 768 for chunk ${chunk.id}`);
    }
  });
});
