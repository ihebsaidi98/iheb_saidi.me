/**
 * src/lib/docker-image-pinning.test.ts
 *
 * AUD-07 — no floating container images.
 *
 * Four images were referenced by mutable tags only:
 *
 *   Dockerfile              node:22-alpine            (4 stages)
 *   ai-service/Dockerfile   python:3.12-slim
 *   ai-service/Dockerfile   ghcr.io/astral-sh/uv:latest
 *   docker-compose.yml      nginx:alpine
 *
 * A tag can be re-pointed by its publisher at any time, so two builds of the
 * same commit can produce different containers and nothing in the repository
 * records what was actually used. They are now pinned to an exact version tag
 * plus the multi-architecture index digest verified against the registry:
 *
 *   node:22.23.4-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202
 *   python:3.12.16-slim@sha256:4840d514c583a4d3d8cad3940e68dee6f0f6f3635c12fcd0a3d74c21a5b93a54
 *   ghcr.io/astral-sh/uv:0.13.7@sha256:96f40d3904aad8d0bd010539001d36c8e2188b981e1334471a90c4a1d93bb490
 *   nginx:1.31.8-alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11
 *
 * Those digests are the OCI *index* (manifest list) digests, not a per-arch
 * manifest, so Docker still selects the right platform on amd64/arm64. They are
 * the digests the floating tags resolved to on 2026-11-06.
 *
 * Updating an image on purpose (see README, "Pinned container images"):
 *   1. choose the new version tag;
 *   2. read its index digest from the registry (`Docker-Content-Digest`);
 *   3. write `<name>:<version>@sha256:<digest>` in the Dockerfile/Compose file;
 *   4. run `npm test` — this file rejects anything unpinned.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/docker-image-pinning.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";

const requireFromHere = createRequire(import.meta.url);
const yaml = requireFromHere("js-yaml") as { load: (input: string) => unknown };

const ROOT = process.cwd();

// Directories that never hold hand-written build files: dependency trees,
// build output and tool caches. Everything else is scanned, so a new Dockerfile
// or Compose file is guarded without touching this list.
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".venv", "venv", "dist", "coverage", "build"]);

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      found.push(...walk(path.join(directory, entry.name)));
    } else if (entry.isFile()) {
      found.push(path.join(directory, entry.name));
    }
  }
  return found;
}

const FILES = walk(ROOT).map((absolute) => path.relative(ROOT, absolute).split(path.sep).join("/"));
const DOCKERFILES = FILES.filter((file) => /(^|\/)Dockerfile[^/]*$/.test(file)).sort();
const COMPOSE_FILES = FILES.filter((file) => /(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(file)).sort();

/** `name[:tag][@sha256:…]` — registry ports (`host:5000/img`) are handled. */
type Reference = { raw: string; name: string; tag: string | undefined; digest: string | undefined };

function splitReference(raw: string): Reference {
  const [nameAndTag, digest] = raw.split("@");
  const lastColon = nameAndTag.lastIndexOf(":");
  const lastSlash = nameAndTag.lastIndexOf("/");
  const hasTag = lastColon > lastSlash;
  return {
    raw,
    name: hasTag ? nameAndTag.slice(0, lastColon) : nameAndTag,
    tag: hasTag ? nameAndTag.slice(lastColon + 1) : undefined,
    digest,
  };
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

type DockerfileRef = { file: string; line: number; kind: "FROM" | "COPY --from"; reference: Reference };

function dockerfileReferences(file: string): DockerfileRef[] {
  const absolute = path.join(ROOT, file);
  assert.ok(existsSync(absolute), `${file} must exist`);

  const lines = readFileSync(absolute, "utf8").split("\n");
  const stageNames = new Set<string>();
  const references: DockerfileRef[] = [];

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const from = line.match(/^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?$/i);
    if (from) {
      if (from[2]) stageNames.add(from[2].toLowerCase());
      references.push({ file, line: index + 1, kind: "FROM", reference: splitReference(from[1]) });
      continue;
    }

    // Cross-stage copies: `COPY --from=deps …` refers to a build stage, not an
    // image. Anything else (`--from=ghcr.io/...`) pulls a container.
    for (const match of line.matchAll(/--from=(\S+)/g)) {
      if (stageNames.has(match[1].toLowerCase())) continue;
      references.push({ file, line: index + 1, kind: "COPY --from", reference: splitReference(match[1]) });
    }
  }

  return references;
}

type ComposeService = { image?: unknown; build?: unknown } & Record<string, unknown>;
type ComposeServiceRef = { file: string; service: string; reference: Reference };

function composeReferences(file: string): ComposeServiceRef[] {
  const absolute = path.join(ROOT, file);
  assert.ok(existsSync(absolute), `${file} must exist`);

  const document = yaml.load(readFileSync(absolute, "utf8")) as { services?: Record<string, ComposeService> } | null;
  assert.equal(typeof document, "object", `${file} must parse to a mapping`);
  assert.notEqual(document, null, `${file} must not be empty`);

  const services = document?.services ?? {};
  assert.ok(Object.keys(services).length > 0, `${file} must declare services`);

  const references: ComposeServiceRef[] = [];
  for (const [service, definition] of Object.entries(services)) {
    if (typeof definition.image !== "string") continue;
    references.push({ file, service, reference: splitReference(definition.image) });
  }
  return references;
}

const dockerfileRefs = DOCKERFILES.flatMap(dockerfileReferences);
const composeRefs = COMPOSE_FILES.flatMap(composeReferences);

describe("AUD-07 — container images are pinned", () => {
  it("found the image references it is meant to guard", () => {
    assert.ok(DOCKERFILES.length > 0, "expected at least one Dockerfile");
    assert.ok(COMPOSE_FILES.length > 0, "expected at least one Compose file");
    assert.ok(dockerfileRefs.length > 0, "expected FROM/COPY --from references in the Dockerfiles");
    assert.ok(composeRefs.length > 0, "expected image references in a Compose file");
  });

  it("pins every base image (FROM) by digest", () => {
    const failures = dockerfileRefs
      .filter((entry) => entry.kind === "FROM")
      .filter((entry) => !entry.reference.digest || !DIGEST_PATTERN.test(entry.reference.digest))
      .map((entry) => `${entry.file}:${entry.line} ${entry.reference.raw}`);

    assert.deepEqual(
      failures,
      [],
      `unpinned base image(s): ${failures.join(", ")} — use <name>:<version>@sha256:<digest>`,
    );
  });

  it("pins every external COPY --from image by digest", () => {
    const failures = dockerfileRefs
      .filter((entry) => entry.kind === "COPY --from")
      .filter((entry) => !entry.reference.digest || !DIGEST_PATTERN.test(entry.reference.digest))
      .map((entry) => `${entry.file}:${entry.line} ${entry.reference.raw}`);

    assert.deepEqual(
      failures,
      [],
      `unpinned COPY --from image(s): ${failures.join(", ")} — use <name>:<version>@sha256:<digest>`,
    );
  });

  it("pins every Compose service image by digest", () => {
    const failures = composeRefs
      .filter((entry) => !entry.reference.digest || !DIGEST_PATTERN.test(entry.reference.digest))
      .map((entry) => `${entry.file}:${entry.service} ${entry.reference.raw}`);

    assert.deepEqual(
      failures,
      [],
      `unpinned service image(s): ${failures.join(", ")} — use <name>:<version>@sha256:<digest>`,
    );
  });

  it("never references the floating `latest` tag", () => {
    const failures = [...dockerfileRefs, ...composeRefs]
      .filter((entry) => entry.reference.tag === "latest" || entry.reference.tag === undefined)
      .map((entry) => `${entry.file}${"line" in entry ? `:${entry.line}` : `:${entry.service}`} ${entry.reference.raw}`);

    assert.deepEqual(failures, [], `image(s) without an explicit version tag: ${failures.join(", ")}`);
  });

  it("keeps the major versions the project was using", () => {
    const expected: Array<[RegExp, string]> = [
      [/^node$/, "22"],
      [/^python$/, "3.12"],
      [/^nginx$/, "1."],
      [/^ghcr\.io\/astral-sh\/uv$/, "0."],
    ];

    for (const [namePattern, major] of expected) {
      const matches = [...dockerfileRefs, ...composeRefs].filter((entry) => namePattern.test(entry.reference.name));
      assert.ok(matches.length > 0, `expected at least one reference to ${namePattern.source}`);
      for (const entry of matches) {
        assert.ok(
          entry.reference.tag?.startsWith(major),
          `${entry.reference.name} must stay on major ${major}, found ${String(entry.reference.tag)}`,
        );
      }
    }
  });

  it("uses one identical reference per image across all build stages", () => {
    const byName = new Map<string, Set<string>>();
    for (const entry of dockerfileRefs) {
      const seen = byName.get(entry.reference.name) ?? new Set<string>();
      seen.add(`${entry.reference.tag}@${String(entry.reference.digest)}`);
      byName.set(entry.reference.name, seen);
    }

    for (const [name, variants] of byName) {
      assert.equal(
        variants.size,
        1,
        `${name} is referenced with ${variants.size} different tag/digest combinations: ${[...variants].join(", ")}`,
      );
    }
  });

  it("parses every Compose file and each service builds or pulls an image", () => {
    for (const file of COMPOSE_FILES) {
      const document = yaml.load(readFileSync(path.join(ROOT, file), "utf8")) as {
        services?: Record<string, ComposeService>;
      } | null;
      const services = Object.entries(document?.services ?? {});
      assert.ok(services.length > 0, `${file} must declare services`);

      for (const [service, definition] of services) {
        assert.ok(
          typeof definition.build === "object" || typeof definition.image === "string",
          `service "${service}" in ${file} must declare build or image`,
        );
      }
    }
  });
});
