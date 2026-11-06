/**
 * src/lib/workflow-permissions.test.ts
 *
 * AUD-08 — least-privilege guard for the GitHub Actions `GITHUB_TOKEN`.
 *
 * The repository shipped a single workflow (`.github/workflows/ci.yml`) with no
 * `permissions:` key at all. The token then inherits the *repository default*,
 * which is `read and write` on older repositories/orgs: every step of a CI run
 * that only typechecks, tests and builds could also push commits, edit issues
 * and publish packages. The workflow is now explicit; these tests keep it that
 * way.
 *
 * What is asserted:
 *   - every workflow declares explicit permissions, as a mapping;
 *   - `write-all`, `read-all` and any `*: write` scope are rejected;
 *   - the effective permissions of each job are exactly the ones its steps need
 *     (nothing granted "just in case", nothing needed but missing);
 *   - no workflow listens to `pull_request_target` / `workflow_run`, the two
 *     triggers that can hand a fork's code a write-scoped token.
 *
 * The workflows are parsed as YAML (js-yaml, already present in the dependency
 * tree), not matched with regular expressions on the raw file. `run:` commands
 * are only inspected for the handful of *write* operations that would justify a
 * new permission — the list below is the single place to extend.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/workflow-permissions.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";

const requireFromHere = createRequire(import.meta.url);
const yaml = requireFromHere("js-yaml") as { load: (input: string) => unknown };

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");

type Permissions = Record<string, string>;
type Step = Record<string, unknown>;
type Job = { permissions?: unknown; steps?: Step[] } & Record<string, unknown>;
type Workflow = { on?: unknown; permissions?: unknown; jobs?: Record<string, Job> } & Record<string, unknown>;

const workflowFiles = readdirSync(WORKFLOW_DIR)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

function parseWorkflow(file: string): Workflow {
  const document = yaml.load(readFileSync(path.join(WORKFLOW_DIR, file), "utf8"));
  assert.equal(typeof document, "object", `${file} must parse to a mapping`);
  assert.notEqual(document, null, `${file} must not be empty`);
  return document as Workflow;
}

/** Permissions granted to a job: a job-level map replaces the workflow map. */
function effectivePermissions(workflow: Workflow, job: Job): Record<string, unknown> {
  const source = job.permissions !== undefined ? job.permissions : workflow.permissions;
  if (source === undefined) return {};
  // A string form (`write-all`, `read-all`) is reported by its own test; treat
  // it as "unknown" here so the exact-match test cannot pass by accident.
  if (typeof source === "string") return { __string_form__: source };
  return source as Record<string, unknown>;
}

function triggerKeys(workflow: Workflow): string[] {
  const on = workflow.on;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on !== null && typeof on === "object") return Object.keys(on as Record<string, unknown>);
  return [];
}

/** A write operation a step would need, and the permission it requires. */
type WriteOperation = { permission: string; detection: string; matches: (step: Step) => boolean };

const WRITE_OPERATIONS: WriteOperation[] = [
  {
    permission: "pull-requests",
    detection: "gh pr <mutation>",
    matches: (step) => /^\s*gh\s+pr\s+(comment|review|edit|close|merge|create)\b/m.test(String(step.run ?? "")),
  },
  {
    permission: "issues",
    detection: "gh issue <mutation>",
    matches: (step) => /^\s*gh\s+issue\s+(create|comment|edit|close)\b/m.test(String(step.run ?? "")),
  },
  {
    permission: "contents",
    detection: "git push / gh release",
    matches: (step) => /^\s*(git\s+push|gh\s+release)\b/m.test(String(step.run ?? "")),
  },
  {
    permission: "packages",
    detection: "npm publish / docker push",
    matches: (step) =>
      /^\s*(npm\s+publish|docker\s+push)\b/m.test(String(step.run ?? "")) ||
      String(step.uses ?? "").startsWith("docker/build-push-action"),
  },
  {
    permission: "security-events",
    detection: "upload-sarif / codeql analyze",
    matches: (step) =>
      String(step.uses ?? "").includes("upload-sarif") ||
      String(step.uses ?? "").includes("codeql-action/analyze"),
  },
  {
    permission: "actions",
    detection: "gh workflow run",
    matches: (step) => /^\s*gh\s+workflow\s+run\b/m.test(String(step.run ?? "")),
  },
];

/** Permissions the given steps actually need. `contents: read` for checkout. */
function requiredPermissions(steps: Step[]): Permissions {
  const required: Permissions = {};
  for (const step of steps) {
    const uses = String(step.uses ?? "");
    if (uses.startsWith("actions/checkout")) {
      required.contents = "read";
    }
    for (const operation of WRITE_OPERATIONS) {
      if (operation.matches(step)) {
        required[operation.permission] = "write";
      }
    }
  }
  return required;
}

describe("AUD-08 — GitHub Actions token permissions", () => {
  it("finds at least one workflow", () => {
    assert.ok(workflowFiles.length > 0, "expected at least one file in .github/workflows");
  });

  for (const file of workflowFiles) {
    describe(file, () => {
      const workflow = parseWorkflow(file);
      const jobs = Object.entries(workflow.jobs ?? {});
      assert.ok(jobs.length > 0, `${file} must declare at least one job`);

      it("declares explicit permissions instead of inheriting the repository default", () => {
        if (workflow.permissions !== undefined) return;
        for (const [jobName, job] of jobs) {
          assert.notEqual(
            job.permissions,
            undefined,
            `job "${jobName}" in ${file} must declare permissions (or the workflow must)`,
          );
        }
      });

      it("never grants write-all or read-all", () => {
        for (const [jobName, job] of jobs) {
          const granted = effectivePermissions(workflow, job);
          for (const [scope, level] of Object.entries(granted)) {
            assert.equal(
              scope.startsWith("__string_form__"),
              false,
              `${file}: job "${jobName}" uses the shorthand "${level}" instead of an explicit scope map`,
            );
          }
        }
      });

      it("never grants a write scope", () => {
        for (const [jobName, job] of jobs) {
          for (const [scope, level] of Object.entries(effectivePermissions(workflow, job))) {
            assert.equal(
              level,
              "read",
              `${file}: job "${jobName}" grants ${scope}: ${String(level)} — CI only verifies code`,
            );
          }
        }
      });

      it("grants exactly the permissions its steps need", () => {
        for (const [jobName, job] of jobs) {
          const effective = effectivePermissions(workflow, job);
          const required = requiredPermissions(job.steps ?? []);

          for (const [scope, level] of Object.entries(required)) {
            assert.equal(
              effective[scope],
              level,
              `${file}: job "${jobName}" needs ${scope}: ${level} but declares ${String(effective[scope])}`,
            );
          }
          for (const scope of Object.keys(effective)) {
            assert.ok(
              Object.hasOwn(required, scope),
              `${file}: job "${jobName}" grants "${scope}" but no step needs it`,
            );
          }
        }
      });

      it("does not listen to fork-privileged triggers", () => {
        const triggers = triggerKeys(workflow);
        for (const forbidden of ["pull_request_target", "workflow_run"]) {
          assert.equal(
            triggers.includes(forbidden),
            false,
            `${file} listens to ${forbidden}, which can run a fork's code with a write-scoped token`,
          );
        }
        assert.ok(
          triggers.some((trigger) => ["push", "pull_request", "workflow_dispatch", "schedule"].includes(trigger)),
          `${file} has no recognised trigger`,
        );
      });
    });
  }
});
