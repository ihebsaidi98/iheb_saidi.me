/**
 * src/lib/health-exposure.test.ts
 *
 * AUD-13 — exposure guard for the `/health/*` metadata.
 *
 * These tests do not exercise runtime code: they assert the *deployment and
 * documentation* that decide whether the internal health metadata can be
 * reached from the internet, and that the one public health endpoint stays
 * minimal. The defect being fixed is documentation drift, which is what makes
 * an internal endpoint become public:
 *
 *   - `README.md` documented `curl http://localhost:8000/health`, i.e. the
 *     container port (never published) instead of the host port Compose maps
 *     (8001), and the path `/health`, which is not a route at all — FastAPI
 *     only serves `/health/live` and `/health/ready`. Following it yields a 404
 *     and invites "fixing" the port by publishing it beyond loopback.
 *   - `README.md` announced the microservice on `localhost:8000` while
 *     `npm run ai:dev` pins `--port 8001`.
 *   - `ai-service/README.md` documented an incomplete readiness payload and did
 *     not state that the unauthenticated probe must stay loopback-only.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/health-exposure.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();

function readFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Extract one service block from docker-compose.yml without a YAML parser. */
function composeServiceBlock(yaml: string, serviceName: string): string {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === `  ${serviceName}:`);
  assert.notEqual(start, -1, `service "${serviceName}" must exist in docker-compose.yml`);

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[a-z][\w-]*:\s*$/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

const COMPOSE = readFile("docker-compose.yml");
const NGINX = readFile("nginx/nginx.conf");
const README = readFile("README.md");
const AI_README = readFile("ai-service/README.md");
const HEALTH_PY = readFile("ai-service/app/api/health.py");
const AI_HEALTH_ROUTE = readFile("src/app/api/ai/health/route.ts");
const PKG = JSON.parse(readFile("package.json")) as { scripts: Record<string, string> };

describe("AUD-13 — the internal health service cannot be reached from the internet", () => {
  it("publishes the ai-service port on loopback only", () => {
    const block = composeServiceBlock(COMPOSE, "ai-service");
    assert.ok(
      block.includes('"127.0.0.1:8001:8000"'),
      "the ai-service port must stay bound to 127.0.0.1 (unauthenticated /health/* metadata)",
    );
    for (const forbidden of ['"8000:8000"', '"0.0.0.0:8000:8000"', '"8001:8000"']) {
      assert.equal(
        block.includes(forbidden),
        false,
        `publishing ${forbidden} would expose the unauthenticated /health/* endpoints`,
      );
    }
  });

  it("runs the ai-service with ENVIRONMENT=production, which disables /docs and /openapi.json", () => {
    assert.ok(
      composeServiceBlock(COMPOSE, "ai-service").includes("ENVIRONMENT=production"),
      "Compose must pin ENVIRONMENT=production",
    );
    const config = readFile("ai-service/app/config.py");
    assert.ok(
      config.includes('return self.environment not in ("staging", "production")'),
      "is_docs_enabled() must stay false in staging and production",
    );
  });

  it("never publishes the frontend container", () => {
    const block = composeServiceBlock(COMPOSE, "frontend");
    assert.ok(block.includes("expose:"), "the frontend is reached through the proxy");
    assert.equal(block.includes("ports:"), false, "the frontend must not publish a port");
  });

  it("exposes exactly one public listener: the proxy on 3000:80", () => {
    assert.ok(composeServiceBlock(COMPOSE, "proxy").includes('"3000:80"'));
    const published = COMPOSE.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- \"") && line.includes(":"));
    assert.deepEqual(published, ['- "127.0.0.1:8001:8000"', '- "3000:80"'].map((l) => l), "only these ports may be published");
  });

  it("proxies every path to the frontend and nothing to the ai-service", () => {
    const proxyPasses = [...NGINX.matchAll(/proxy_pass\s+(\S+);/g)].map((m) => m[1]);
    assert.deepEqual(proxyPasses, ["http://frontend:3000"]);
    assert.equal(/proxy_pass\s+https?:\/\/[^;]*(8000|8001|ai-service)/.test(NGINX), false);
    assert.equal(/(8000|8001)/.test(NGINX), false, "nginx must not know the internal port");
  });

  it("serves a constant /healthz body with no upstream metadata", () => {
    const match = NGINX.match(/location = \/healthz \{[\s\S]*?\n {4}\}/);
    assert.ok(match, "a dedicated /healthz location must exist");
    const block = match[0];
    assert.ok(block.includes('return 200 "ok\\n"'));
    assert.ok(block.includes("access_log off"));
    assert.equal(/proxy_pass/.test(block), false, "/healthz must not proxy to an upstream");
  });

  it("probes /health/ready over the container port in the compose healthcheck", () => {
    assert.ok(
      composeServiceBlock(COMPOSE, "ai-service").includes(
        'curl -fsS http://localhost:8000/health/ready',
      ),
    );
  });
});

describe("AUD-13 — the health route inventory stays small and unauthenticated by design", () => {
  it("exposes exactly /health/live and /health/ready", () => {
    const paths = [...HEALTH_PY.matchAll(/@router\.get\(\s*\n?\s*"([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(paths.sort(), ["/live", "/ready"]);
    assert.equal(HEALTH_PY.includes('"/"'), false, "a bare /health route would add surface for nothing");
  });

  it("keeps the probes unauthenticated (that is what makes loopback-binding mandatory)", () => {
    assert.equal(HEALTH_PY.includes("verify_internal_token"), false);
    assert.equal(HEALTH_PY.includes("Depends(verify"), false);
    // By contrast, everything under /v1 is authenticated.
    assert.ok(readFile("ai-service/app/api/v1/router.py").includes("Depends(verify_internal_token)"));
  });

  it("keeps the readiness payload free of filesystem paths and secret material", () => {
    // The values themselves are validated by ai-service/tests/integration/test_health.py;
    // here we guard the model definition, which is what could gain a new field.
    // Only the pydantic class body: the handler signature below it is indented
    // the same way and would otherwise be picked up as a "field".
    const modelStart = HEALTH_PY.indexOf("class ReadinessResponse");
    const model = HEALTH_PY.slice(modelStart, HEALTH_PY.indexOf("@router.get", modelStart));
    const fields = [...model.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
    assert.deepEqual(fields, [
      "status",
      "service",
      "version",
      "environment",
      "gemini_configured",
      "index_loaded",
      "index_records",
    ]);
    for (const forbidden of ["path", "token", "key", "url", "error"]) {
      assert.equal(
        new RegExp(`^ {4}\\w*${forbidden}\\w*:`, "im").test(model),
        false,
        `the readiness model must not expose a "${forbidden}" field`,
      );
    }
  });

  it("keeps the public endpoint's payload limited to the readiness verdict", () => {
    // The behavioural assertion lives in src/app/api/ai/health/route.test.ts;
    // this is the source-level drift guard against spreading the upstream body.
    const code = AI_HEALTH_ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.equal(/\.\.\.\s*health\b/.test(code), false, "never spread the upstream health body");
    assert.ok(code.includes("pythonService: { status: health.status }"));
    assert.equal(/gemini_configured|index_records|environment:/.test(code), false);
  });
});

describe("AUD-13 — the documented health commands match the deployment", () => {
  it("documents the host port Compose actually publishes, on a route that exists", () => {
    const commands = [...README.matchAll(/curl\s+http:\/\/localhost:(\d+)\/health(\/[\w-]+)?/g)];
    assert.ok(commands.length > 0, "README must document a health command");

    for (const [, port, routePath] of commands) {
      assert.equal(port, "8001", "Compose maps host 8001 to container 8000; 8000 is not reachable");
      assert.ok(
        ["/live", "/ready"].includes(routePath ?? ""),
        `"/health${routePath ?? ""}" is not a route: only /health/live and /health/ready exist`,
      );
    }
  });

  it("does not mention the container-only port 8000", () => {
    assert.equal(README.includes("localhost:8000"), false);
    assert.equal(README.includes("127.0.0.1:8000"), false);
  });

  it("documents the same microservice port as `npm run ai:dev`", () => {
    const devScript = PKG.scripts["ai:dev"] ?? "";
    assert.ok(devScript.includes("--port 8001"), "ai:dev pins 8001");
    assert.ok(devScript.includes("--host 127.0.0.1"), "ai:dev binds loopback");
    assert.ok(README.includes("localhost:8001"));
  });

  it("documents the complete readiness payload and the loopback invariant", () => {
    for (const field of [
      "environment",
      "gemini_configured",
      "index_loaded",
      "index_records",
    ]) {
      assert.ok(
        AI_README.includes(field),
        `ai-service/README.md must document the "${field}" field of /health/ready`,
      );
    }
    assert.ok(
      /never publish/i.test(AI_README),
      "the unauthenticated probes must be documented as loopback-only",
    );
  });
});
