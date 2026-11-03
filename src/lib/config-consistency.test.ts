/**
 * src/lib/config-consistency.test.ts
 *
 * H3 / M1 — configuration drift guard.
 *
 * These tests do not exercise runtime code: they assert that the files that
 * *deploy* the app agree with each other and with the defaults baked into the
 * code. Configuration drift is the actual defect being fixed here:
 *
 *   - `docker-compose.yml` used to inherit `TRUSTED_PROXY=false` from the
 *     generated `.env.local`, so the production stack served by the bundled
 *     Nginx answered 500 IP_VERIFICATION_FAILED on every rate-limited route.
 *   - `.env.example`, `scripts/setup-env.py` and `README.md` disagreed on the
 *     value of `TRUSTED_PROXY`.
 *   - Several variables read by the code (interview rate limiting,
 *     `AI_SERVICE_ENABLED`, `TRUSTED_PROXY_HEADER`) were undocumented.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/config-consistency.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();

function readFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Parse the active `KEY=value` entries of a dotenv-style template. */
function parseDotenv(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    entries.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return entries;
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

const envExample = readFile(".env.example");
const aiEnvExample = readFile("ai-service/.env.example");
const compose = readFile("docker-compose.yml");
const setupEnvScript = readFile("scripts/setup-env.py");
const readme = readFile("README.md");
const nginxConf = readFile("nginx/nginx.conf");
const aiReadme = readFile("ai-service/README.md");

// Defaults actually baked into the code (see the route modules below).
const CODE_DEFAULTS = {
  CHAT_RATE_LIMIT: "10",
  CHAT_RATE_WINDOW_MS: "60000",
  INTERVIEW_RATE_LIMIT: "15",
  INTERVIEW_RATE_WINDOW_MS: "60000",
  LLM_TIMEOUT_MS: "45000",
  GEMINI_CHAT_MODEL: "gemini-3.5-flash-lite",
} as const;

// ============================================================
// H3-1 — docker compose must opt into proxy trust explicitly
// ============================================================

describe("docker-compose proxy configuration (H3-1)", () => {
  const frontend = composeServiceBlock(compose, "frontend");

  it("sets TRUSTED_PROXY=true for the frontend service", () => {
    assert.match(
      frontend,
      /^\s*-\s*TRUSTED_PROXY=true\s*$/m,
      "frontend.environment must set TRUSTED_PROXY=true",
    );
  });

  it("sets TRUSTED_PROXY_HEADER=x-forwarded-for for the frontend service", () => {
    assert.match(
      frontend,
      /^\s*-\s*TRUSTED_PROXY_HEADER=x-forwarded-for\s*$/m,
      "frontend.environment must pin the header written by nginx/nginx.conf",
    );
  });

  it("declares the proxy values inside `environment`, which overrides `env_file`", () => {
    // Compose precedence: `environment` always wins over `env_file`, whatever
    // the file order, so an inherited TRUSTED_PROXY=false in .env.local cannot
    // win. This asserts the keys live in the environment mapping, not in a
    // comment or in env_file.
    assert.match(frontend, /^\s*env_file:\s*$/m, "frontend must keep loading .env.local");
    const environmentIndex = frontend.search(/^\s*environment:\s*$/m);
    const envFileIndex = frontend.search(/^\s*env_file:\s*$/m);
    assert.notEqual(environmentIndex, -1, "frontend.environment must exist");
    assert.ok(
      environmentIndex > envFileIndex,
      "TRUSTED_PROXY entries must be listed under frontend.environment",
    );
  });

  it("keeps the frontend unreachable except through the bundled nginx proxy", () => {
    assert.doesNotMatch(
      frontend,
      /^\s*-\s*"?\d+:\d+"?/m,
      "frontend must stay `expose`-only; publishing it would let clients forge X-Forwarded-For",
    );
    assert.match(frontend, /expose:\s*\n\s*-\s*"3000"/);
  });
});

// ============================================================
// H3-2 / M1 — one single source of truth for the templates
// ============================================================

describe(".env.example (H3-2, M1)", () => {
  const values = parseDotenv(envExample);

  it("documents direct development with TRUSTED_PROXY=false", () => {
    assert.equal(values.get("TRUSTED_PROXY"), "false");
  });

  it("documents TRUSTED_PROXY_HEADER with the nginx default", () => {
    assert.equal(values.get("TRUSTED_PROXY_HEADER"), "x-forwarded-for");
  });

  it("documents the interview rate limits with the code defaults", () => {
    assert.equal(values.get("INTERVIEW_RATE_LIMIT"), CODE_DEFAULTS.INTERVIEW_RATE_LIMIT);
    assert.equal(
      values.get("INTERVIEW_RATE_WINDOW_MS"),
      CODE_DEFAULTS.INTERVIEW_RATE_WINDOW_MS,
    );
  });

  it("documents the chat rate limits and the LLM timeout with the code defaults", () => {
    assert.equal(values.get("CHAT_RATE_LIMIT"), CODE_DEFAULTS.CHAT_RATE_LIMIT);
    assert.equal(values.get("CHAT_RATE_WINDOW_MS"), CODE_DEFAULTS.CHAT_RATE_WINDOW_MS);
    assert.equal(values.get("LLM_TIMEOUT_MS"), CODE_DEFAULTS.LLM_TIMEOUT_MS);
  });

  it("documents AI_SERVICE_ENABLED and its kill-switch semantics", () => {
    assert.match(envExample, /AI_SERVICE_ENABLED/, "AI_SERVICE_ENABLED must be documented");
    assert.match(
      envExample,
      /AI_SERVICE_ENABLED[\s\S]{0,300}?"false"/,
      "the documentation must state that only \"false\" disables delegation",
    );
  });

  it("keeps AI_SERVICE_TOKEN without any default value (H2)", () => {
    assert.equal(values.get("AI_SERVICE_TOKEN"), "");
  });

  it("contains no packaging artefact line", () => {
    assert.doesNotMatch(envExample, /^\s*\[TEMPLATE\]\s*$/m);
    assert.doesNotMatch(aiEnvExample, /^\s*\[TEMPLATE\]\s*$/m);
  });
});

describe("scripts/setup-env.py generated frontend env (H3-2, M1)", () => {
  const template = (setupEnvScript.split('FRONTEND_TEMPLATE = """')[1] ?? "").split('"""')[0] ?? "";
  const generated = parseDotenv(template);
  const example = parseDotenv(envExample);

  it("generates TRUSTED_PROXY=false, as documented for direct development", () => {
    assert.equal(generated.get("TRUSTED_PROXY"), "false");
  });

  it("agrees with .env.example on every shared key", () => {
    const sharedKeys = [
      "GEMINI_CHAT_MODEL",
      "GEMINI_EMBEDDING_MODEL",
      "CHAT_RATE_LIMIT",
      "CHAT_RATE_WINDOW_MS",
      "INTERVIEW_RATE_LIMIT",
      "INTERVIEW_RATE_WINDOW_MS",
      "TECH_NEWS_RATE_LIMIT",
      "TECH_NEWS_RATE_WINDOW_MS",
      "CSP_REPORT_RATE_LIMIT",
      "CSP_REPORT_RATE_WINDOW_MS",
      "LLM_TIMEOUT_MS",
      "TRUSTED_PROXY",
      "TRUSTED_PROXY_HEADER",
    ];

    for (const key of sharedKeys) {
      assert.ok(generated.has(key), `setup-env.py must write ${key}`);
      assert.ok(example.has(key), `.env.example must document ${key}`);
      assert.equal(
        generated.get(key),
        example.get(key),
        `${key} differs between setup-env.py and .env.example`,
      );
    }
  });

  it("uses the chat model that the code actually defaults to", () => {
    assert.equal(generated.get("GEMINI_CHAT_MODEL"), CODE_DEFAULTS.GEMINI_CHAT_MODEL);
  });

  it("still generates the shared internal token (H2)", () => {
    assert.match(template, /^AI_SERVICE_TOKEN=\{token\}$/m);
  });
});

// ============================================================
// M1 — user-facing documentation
// ============================================================

describe("README.md environment documentation (H3-2, M1)", () => {
  it("states that docker compose forces TRUSTED_PROXY=true behind nginx", () => {
    assert.match(readme, /docker-compose\.yml/, "README must reference the compose file");
    assert.match(
      readme,
      /TRUSTED_PROXY=true/,
      "README must state that the compose stack runs in trusted-proxy mode",
    );
  });

  it("keeps TRUSTED_PROXY=false as the default for direct development", () => {
    assert.match(readme, /TRUSTED_PROXY=false`?\s*\(Default\)/);
  });

  it("documents the variables that were missing", () => {
    for (const variable of [
      "TRUSTED_PROXY_HEADER",
      "CHAT_RATE_LIMIT",
      "CHAT_RATE_WINDOW_MS",
      "INTERVIEW_RATE_LIMIT",
      "INTERVIEW_RATE_WINDOW_MS",
      "AI_SERVICE_ENABLED",
      "LLM_TIMEOUT_MS",
    ]) {
      assert.ok(
        readme.includes(`\`${variable}\``),
        `README must document ${variable}`,
      );
    }
  });
});

describe("ai-service/README.md PORT documentation (M1)", () => {
  it("documents the real local default (8001) and the container port (8000)", () => {
    assert.match(
      aiReadme,
      /^\|\s*`PORT`\s*\|\s*Integer\s*\|\s*`8001`\s*\|/m,
      "the table must show the config.py default of 8001",
    );
    assert.match(
      aiReadme,
      /8000/,
      "the Docker override (--port 8000) must stay documented",
    );
  });
});

// ============================================================
// H3-3 / H3-4 — startup validation wiring
// ============================================================

const INSTRUMENTATION_FILE = "src/instrumentation.ts";
const ENV_CONFIG_FILE = "src/lib/env-config.ts";

/** Read a source file that the guard needs, failing with a readable message. */
function readSource(relativePath: string): string {
  assert.ok(existsSync(path.join(ROOT, relativePath)), `${relativePath} must exist`);
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Extract one Markdown section, from its heading to the next heading. */
function markdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `README must contain the section "${heading}"`);
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/^#{2,3} /m);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("src/instrumentation.ts (H3-3, H3-4)", () => {
  it("exists and exports the register() hook", () => {
    const source = readSource(INSTRUMENTATION_FILE);
    assert.match(source, /export\s+async\s+function\s+register\s*\(/, "register must be an exported async function");
  });

  it("validates only in the Node.js runtime, never in the Edge sandbox", () => {
    const source = stripComments(readSource(INSTRUMENTATION_FILE));
    assert.match(
      source,
      /process\.env\.NEXT_RUNTIME\s*!==\s*["']nodejs["']/, 
      "register() must bail out unless NEXT_RUNTIME === 'nodejs' (opengraph-image runs on Edge)",
    );
  });

  it("keeps the validator behind a dynamic import", () => {
    const source = stripComments(readSource(INSTRUMENTATION_FILE));
    assert.match(
      source,
      /await\s+import\(\s*["']@\/lib\/env-config["']\s*\)/,
      "the validator must be loaded with await import('@/lib/env-config')",
    );
    assert.doesNotMatch(
      source,
      /^\s*import\s[^;]*from\s+["'][^"']*env-config["']/m,
      "a static import would pull the validator into the Edge bundle",
    );
  });

  it("does not import chat.ts", () => {
    const source = stripComments(readSource(INSTRUMENTATION_FILE));
    assert.doesNotMatch(
      source,
      /from\s+["'][^"']*(\/chat|lib\/chat)["']/,
      "instrumentation must stay independent from the IP/chat module",
    );
  });

  it("does not read the proxy variables itself", () => {
    const source = stripComments(readSource(INSTRUMENTATION_FILE));
    assert.doesNotMatch(
      source,
      /process\.env\.TRUSTED_PROXY/,
      "validation belongs to src/lib/env-config.ts only",
    );
  });
});

describe("src/lib/env-config.ts (H3-3, H3-4)", () => {
  const source = readSource(ENV_CONFIG_FILE);
  const code = stripComments(source);

  it("exports the parsers, the startup validator and the error type", () => {
    for (const name of [
      "parseTrustedProxy",
      "parseTrustedProxyHeader",
      "validateProxyEnv",
      "EnvConfigurationError",
    ]) {
      assert.match(code, new RegExp(`export\\s+(async\\s+)?(function|class|const)\\s+${name}\\b`), `${name} must be exported`);
    }
  });

  it("takes the environment as an argument instead of reading process.env", () => {
    assert.doesNotMatch(
      code,
      /process\.env/,
      "the module must stay pure so it is testable without touching the process",
    );
  });

  it("does not depend on chat.ts or on Node builtins", () => {
    assert.doesNotMatch(code, /from\s+["'][^"']*\/chat["']/);
    assert.doesNotMatch(code, /from\s+["']node:/);
  });
});

// ============================================================
// H3-5 — client IP boundary at the bundled Nginx proxy
// ============================================================

/** Values that would forward a client-controlled chain instead of a verified peer. */
const CLIENT_CONTROLLED_CHAIN = [/\$http_x_forwarded_for\b/, /\$proxy_add_x_forwarded_for\b/];

/**
 * H3-5 — `real_ip_header` is only meaningful when the trusted sources are
 * enumerated: nginx trusts no address by default, so the realip module stays
 * inert and `$remote_addr` silently remains the address of the CDN/LB node.
 *
 * Returns the pairing violations found in a configuration, so that enabling
 * realip later cannot be done half-way.
 */
function realIpViolations(source: string): string[] {
  const code = stripComments(source);
  const hasHeader = /^\s*real_ip_header\s+\S/m.test(code);
  const hasFrom = /^\s*set_real_ip_from\s+\S/m.test(code);
  const hasRecursive = /^\s*real_ip_recursive\s+\S/m.test(code);

  const violations: string[] = [];
  if (hasHeader && !hasFrom) {
    violations.push("real_ip_header requires set_real_ip_from (nginx trusts no address by default)");
  }
  if (hasFrom && !hasHeader) {
    violations.push("set_real_ip_from requires an explicit real_ip_header");
  }
  if (hasRecursive && !hasFrom) {
    violations.push("real_ip_recursive requires set_real_ip_from");
  }
  return violations;
}

describe("nginx/nginx.conf client IP boundary (H3-5)", () => {
  const config = stripComments(nginxConf);

  it("replaces X-Forwarded-For with the address of the direct peer", () => {
    assert.match(
      config,
      /^\s*proxy_set_header\s+X-Forwarded-For\s+\$remote_addr\s*;$/m,
      "X-Forwarded-For must be overwritten with $remote_addr, never forwarded from the client",
    );
  });

  it("replaces X-Real-IP with the same verified address", () => {
    assert.match(
      config,
      /^\s*proxy_set_header\s+X-Real-IP\s+\$remote_addr\s*;$/m,
      "X-Real-IP must be overwritten too: an untrusted secondary header could hijack the rate-limit key",
    );
  });

  it("declares both headers at server level, before the proxying location", () => {
    // Server-level directives are inherited by `location /`, which is what makes
    // the overwrite apply to every proxied request. Moving them inside a single
    // location would silently leave the others unprotected.
    const headerIndex = config.search(/^\s*proxy_set_header\s+X-Forwarded-For\s/m);
    const locationIndex = config.search(/^\s*location\s+\/\s*\{/m);
    assert.notEqual(headerIndex, -1, "the X-Forwarded-For overwrite must exist");
    assert.notEqual(locationIndex, -1, "the proxying location must exist");
    assert.ok(
      headerIndex < locationIndex,
      "the IP headers must be declared at server level so every location inherits them",
    );
  });

  it("strips the CDN headers the application never reads", () => {
    for (const header of ["CF-Connecting-IP", "True-Client-IP", "X-Cluster-Client-IP"]) {
      assert.match(
        config,
        new RegExp(`^\\s*proxy_set_header\\s+${header}\\s+""\\s*;$`, "mi"),
        `${header} must be emptied: it is client-controllable and must not reach the app`,
      );
    }
  });

  it("never forwards a client-supplied X-Forwarded-For chain", () => {
    for (const pattern of CLIENT_CONTROLLED_CHAIN) {
      assert.doesNotMatch(
        config,
        pattern,
        "forwarding a client chain would let a caller choose the last segment read by the limiter",
      );
    }
  });

  it("keeps realip disabled or fully paired with trusted sources", () => {
    assert.deepEqual(realIpViolations(nginxConf), []);
  });
});

describe("realip guard (H3-5)", () => {
  it("accepts a complete realip block", () => {
    const source = [
      "server {",
      "    set_real_ip_from 203.0.113.0/24;",
      "    real_ip_header CF-Connecting-IP;",
      "    real_ip_recursive on;",
      "}",
    ].join("\n");
    assert.deepEqual(realIpViolations(source), []);
  });

  it("rejects a real_ip_header without trusted sources", () => {
    assert.deepEqual(realIpViolations("server {\n  real_ip_header CF-Connecting-IP;\n}"), [
      "real_ip_header requires set_real_ip_from (nginx trusts no address by default)",
    ]);
  });

  it("rejects trusted sources without an explicit header", () => {
    assert.deepEqual(realIpViolations("server {\n  set_real_ip_from 10.0.0.0/8;\n}"), [
      "set_real_ip_from requires an explicit real_ip_header",
    ]);
  });

  it("rejects real_ip_recursive without trusted sources", () => {
    assert.deepEqual(realIpViolations("server {\n  real_ip_recursive on;\n}"), [
      "real_ip_recursive requires set_real_ip_from",
    ]);
  });

  it("ignores directives that only appear in comments", () => {
    assert.deepEqual(realIpViolations("server {\n  # real_ip_header CF-Connecting-IP;\n}"), []);
  });
});

describe("client IP documentation (H3-5)", () => {
  const section = markdownSection(readme, "### Reverse Proxy & Client IP Verification");

  it("explains that the bundled Nginx overwrites the trusted headers with $remote_addr", () => {
    assert.match(section, /\$remote_addr/);
    assert.match(section, /X-Forwarded-For/);
    assert.match(section, /X-Real-IP/);
  });

  it("states that a CDN or load balancer makes the per-IP quota shared", () => {
    assert.match(section, /CDN/);
    assert.match(section, /load balancer/i);
    assert.match(
      section,
      /(shared|single|one)[\s\S]{0,40}(quota|budget|key)/i,
      "the documentation must warn that the per-IP quota becomes shared behind a proxy",
    );
  });

  it("states that the bundled Nginx deletes the CDN headers", () => {
    assert.match(section, /(strip|delete|discard|remove)s?[\s\S]{0,160}CF-Connecting-IP/i);
  });

  it("states that cf-connecting-ip must not be selected with this configuration", () => {
    assert.match(section, /cf-connecting-ip/i);
    assert.match(
      section,
      /x-forwarded-for`? (is|remains) the only value that works/i,
      "the documentation must state which header is usable with the bundled Nginx",
    );
    assert.match(
      section,
      /cf-connecting-ip[\s\S]{0,300}IP_VERIFICATION_FAILED/i,
      "the documentation must warn that selecting cf-connecting-ip behind the bundled Nginx fails closed",
    );
  });

  it("warns in .env.example against cf-connecting-ip with the bundled Nginx", () => {
    assert.match(envExample, /cf-connecting-ip[\s\S]{0,300}(strips?|deletes?|removes?)/i);
  });

  it("warns in .env.example that a CDN turns the rate limits into a shared quota", () => {
    assert.match(envExample, /CDN[\s\S]{0,260}shared quota/i);
  });
});

describe("next.config.mjs Edge exclusion (H3-3, H3-4)", () => {
  it("resolves the validator to an empty module for the Edge compilation", () => {
    const nextConfig = readFile("next.config.mjs");
    assert.match(
      nextConfig,
      /nextRuntime\s*===\s*["']edge["']/,
      "the webpack hook must branch on the Edge runtime",
    );
    assert.match(
      nextConfig,
      /new webpack\.IgnorePlugin\(/,
      "the Edge compilation must ignore the validator module",
    );
    assert.match(
      nextConfig,
      /resourceRegExp:[^\n]*env-config/,
      "the ignored resource must be the proxy validator module",
    );
  });

  it("keeps the SVG handling of the existing webpack hook untouched", () => {
    const nextConfig = readFile("next.config.mjs");
    assert.match(nextConfig, /@svgr\/webpack/);
    assert.match(nextConfig, /fileLoaderRule\.exclude = \/\\\.svg\$\/i;/);
  });
});

describe("test wiring for the startup guards", () => {
  it("runs the new test file from `npm test`", () => {
    const packageJson = JSON.parse(readFile("package.json")) as { scripts: Record<string, string> };
    assert.match(
      packageJson.scripts.test ?? "",
      /src\/lib\/env-config\.test\.ts/,
      "the explicit test list in package.json must include env-config.test.ts",
    );
  });
});
