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
