/**
 * src/lib/env-config.test.ts
 *
 * H3-3 / H3-4 — proxy environment validation.
 *
 * These tests cover the pure parsers only: no server, no Next runtime. The
 * `validateProxyEnv` suite covers the startup policy (fatal vs warning) with an
 * injected logger, and the last suite pins the defaults to the behaviour of
 * `extractClientIp`, which is NOT modified by this change.
 *
 * Run with: npm test
 * Or:       npx tsx --test src/lib/env-config.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EnvConfigurationError,
  TRUSTED_PROXY_HEADERS,
  parseTrustedProxy,
  parseTrustedProxyHeader,
  validateProxyEnv,
} from "./env-config";
import { ProxyConfigurationError, extractClientIp } from "./chat";

/** Minimal stand-in for `Headers`, matching what `extractClientIp` consumes. */
function makeFakeHeaders(map: Record<string, string>) {
  return {
    get(name: string): string | null {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

/** Run `fn` with the given frontend proxy variables, then restore everything. */
function withProxyEnv<T>(
  values: { TRUSTED_PROXY?: string; TRUSTED_PROXY_HEADER?: string },
  fn: () => T,
): T {
  const envObj = process.env as Record<string, string | undefined>;
  const origProxy = envObj.TRUSTED_PROXY;
  const origHeader = envObj.TRUSTED_PROXY_HEADER;
  try {
    if (values.TRUSTED_PROXY === undefined) delete envObj.TRUSTED_PROXY;
    else envObj.TRUSTED_PROXY = values.TRUSTED_PROXY;

    if (values.TRUSTED_PROXY_HEADER === undefined) delete envObj.TRUSTED_PROXY_HEADER;
    else envObj.TRUSTED_PROXY_HEADER = values.TRUSTED_PROXY_HEADER;

    return fn();
  } finally {
    if (origProxy === undefined) delete envObj.TRUSTED_PROXY;
    else envObj.TRUSTED_PROXY = origProxy;

    if (origHeader === undefined) delete envObj.TRUSTED_PROXY_HEADER;
    else envObj.TRUSTED_PROXY_HEADER = origHeader;
  }
}

/** Assert that `fn` throws an EnvConfigurationError without echoing `raw`. */
function assertRejectsWithoutEcho(raw: string, fn: () => unknown, variable: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof EnvConfigurationError, `expected EnvConfigurationError, got ${String(error)}`);
    assert.equal(error.name, "EnvConfigurationError");
    assert.equal(error.variable, variable);
    assert.ok(
      !error.message.includes(raw),
      `the message must never echo the received value (${raw})`,
    );
    return true;
  });
}

const SECRET_PROXY_VALUE = "enable-proxy-secret";
const SECRET_HEADER_VALUE = "x-very-secret-header";

describe("EnvConfigurationError", () => {
  it("is an Error that carries the offending variable name", () => {
    const error = new EnvConfigurationError("TRUSTED_PROXY", "boom");
    assert.ok(error instanceof Error);
    assert.equal(error.name, "EnvConfigurationError");
    assert.equal(error.variable, "TRUSTED_PROXY");
    assert.equal(error.message, "boom");
  });
});

// ============================================================
// H3-3 — TRUSTED_PROXY
// ============================================================

describe("parseTrustedProxy — accepted values", () => {
  it("treats an unset variable as false (current default, fail closed)", () => {
    assert.equal(parseTrustedProxy(undefined), false);
  });

  it("treats an empty variable as false (dotenv `TRUSTED_PROXY=`)", () => {
    assert.equal(parseTrustedProxy(""), false);
  });

  it("accepts the exact string \"true\"", () => {
    assert.equal(parseTrustedProxy("true"), true);
  });

  it("accepts the exact string \"false\"", () => {
    assert.equal(parseTrustedProxy("false"), false);
  });

  it("never turns trust on for anything but the exact string \"true\"", () => {
    for (const value of ["TRUE", "True", "truE", " true", "true ", "1", "yes", "on", "proxy"]) {
      assert.throws(() => parseTrustedProxy(value), EnvConfigurationError, `${value} must be rejected`);
    }
  });
});

describe("parseTrustedProxy — rejected values (H3-3)", () => {
  const rejected = ["TRUE", "True", "truE", " true", "true ", "  true", "false ", "1", "0", "yes", "on", "off", "proxy"];

  for (const value of rejected) {
    it(`rejects ${JSON.stringify(value)} explicitly instead of silently falling back to false`, () => {
      assert.throws(() => parseTrustedProxy(value), EnvConfigurationError);
    });
  }

  it("names the variable and its allowed values in the error", () => {
    assert.throws(
      () => parseTrustedProxy("TRUE"),
      (error: unknown) => {
        assert.ok(error instanceof EnvConfigurationError);
        assert.match(error.message, /TRUSTED_PROXY/);
        assert.match(error.message, /"true"/);
        assert.match(error.message, /"false"/);
        return true;
      },
    );
  });

  it("never echoes the received value", () => {
    assertRejectsWithoutEcho(SECRET_PROXY_VALUE, () => parseTrustedProxy(SECRET_PROXY_VALUE), "TRUSTED_PROXY");
  });
});

// ============================================================
// H3-4 — TRUSTED_PROXY_HEADER
// ============================================================

describe("parseTrustedProxyHeader — accepted values", () => {
  it("defaults to x-forwarded-for when unset (the header nginx writes)", () => {
    assert.equal(parseTrustedProxyHeader(undefined), "x-forwarded-for");
  });

  it("accepts the three headers the trust rules support", () => {
    for (const header of TRUSTED_PROXY_HEADERS) {
      assert.equal(parseTrustedProxyHeader(header), header);
    }
  });

  it("ignores case and normalises the result to lower case", () => {
    assert.equal(parseTrustedProxyHeader("X-Forwarded-For"), "x-forwarded-for");
    assert.equal(parseTrustedProxyHeader("X-REAL-IP"), "x-real-ip");
    assert.equal(parseTrustedProxyHeader("CF-Connecting-IP"), "cf-connecting-ip");
    assert.equal(parseTrustedProxyHeader("Cf-CoNnEcTiNg-Ip"), "cf-connecting-ip");
  });
});

describe("parseTrustedProxyHeader — rejected values (H3-4)", () => {
  it("rejects surrounding whitespace instead of trimming it silently", () => {
    for (const value of [" x-real-ip", "x-real-ip ", " x-forwarded-for\t", "\ncf-connecting-ip"]) {
      assert.throws(
        () => parseTrustedProxyHeader(value),
        EnvConfigurationError,
        `${JSON.stringify(value)} has surrounding whitespace and must be rejected`,
      );
    }
  });

  it("rejects an empty value", () => {
    assert.throws(() => parseTrustedProxyHeader(""), EnvConfigurationError);
  });

  it("rejects headers that the trust rules do not support", () => {
    for (const value of ["x-forwarded", "forwarded", "true-client-ip", "y-real-ip", "x-forwarded-for, x-real-ip"]) {
      assert.throws(() => parseTrustedProxyHeader(value), EnvConfigurationError, `${value} must be rejected`);
    }
  });

  it("names the variable and the three allowed headers, without the value", () => {
    assertRejectsWithoutEcho(
      SECRET_HEADER_VALUE,
      () => parseTrustedProxyHeader(SECRET_HEADER_VALUE),
      "TRUSTED_PROXY_HEADER",
    );
    assert.throws(
      () => parseTrustedProxyHeader(SECRET_HEADER_VALUE),
      (error: unknown) => {
        assert.ok(error instanceof EnvConfigurationError);
        for (const header of TRUSTED_PROXY_HEADERS) {
          assert.ok(error.message.includes(header), `the message must list ${header}`);
        }
        return true;
      },
    );
  });
});

// ============================================================
// Startup policy — fatal vs warning
// ============================================================

describe("validateProxyEnv — consistent configuration", () => {
  it("returns the resolved pair when trust is enabled", () => {
    const warnings: string[] = [];
    const result = validateProxyEnv(
      { TRUSTED_PROXY: "true", TRUSTED_PROXY_HEADER: "X-Real-IP" },
      { warn: (message) => warnings.push(message) },
    );
    assert.deepEqual(result, { trustedProxy: true, trustedProxyHeader: "x-real-ip" });
    assert.deepEqual(warnings, []);
  });

  it("returns the defaults when nothing is configured", () => {
    const warnings: string[] = [];
    const result = validateProxyEnv({}, { warn: (message) => warnings.push(message) });
    assert.deepEqual(result, { trustedProxy: false, trustedProxyHeader: "x-forwarded-for" });
    assert.deepEqual(warnings, []);
  });

  it("accepts an empty TRUSTED_PROXY as the default while trust is off", () => {
    const warnings: string[] = [];
    const result = validateProxyEnv(
      { TRUSTED_PROXY: "", TRUSTED_PROXY_HEADER: "cf-connecting-ip" },
      { warn: (message) => warnings.push(message) },
    );
    assert.deepEqual(result, { trustedProxy: false, trustedProxyHeader: "cf-connecting-ip" });
    assert.deepEqual(warnings, []);
  });
});

describe("validateProxyEnv — invalid values with trust disabled", () => {
  it("does not block the application and falls back to the default header", () => {
    const warnings: string[] = [];
    const result = validateProxyEnv(
      { TRUSTED_PROXY: "false", TRUSTED_PROXY_HEADER: SECRET_HEADER_VALUE },
      { warn: (message) => warnings.push(message) },
    );
    assert.deepEqual(result, { trustedProxy: false, trustedProxyHeader: "x-forwarded-for" });
    assert.equal(warnings.length, 1, "exactly one warning must be emitted");
  });

  it("warns without echoing the received value or any secret", () => {
    const warnings: string[] = [];
    validateProxyEnv(
      { TRUSTED_PROXY: "false", TRUSTED_PROXY_HEADER: SECRET_HEADER_VALUE },
      { warn: (message) => warnings.push(message) },
    );
    const [warning = ""] = warnings;
    assert.match(warning, /TRUSTED_PROXY_HEADER/);
    assert.ok(!warning.includes(SECRET_HEADER_VALUE), "the warning must not echo the value");
    for (const header of TRUSTED_PROXY_HEADERS) {
      assert.ok(warning.includes(header), `the warning must list ${header}`);
    }
  });

  it("warns for an empty or whitespace-padded header as well", () => {
    for (const value of ["", " x-real-ip"]) {
      const warnings: string[] = [];
      const result = validateProxyEnv(
        { TRUSTED_PROXY: "false", TRUSTED_PROXY_HEADER: value },
        { warn: (message) => warnings.push(message) },
      );
      assert.equal(result.trustedProxyHeader, "x-forwarded-for");
      assert.equal(warnings.length, 1);
    }
  });

  it("uses console.warn when no logger is injected", () => {
    const originalWarn = console.warn;
    const captured: string[] = [];
    console.warn = (message?: unknown) => {
      captured.push(String(message));
    };
    try {
      validateProxyEnv({ TRUSTED_PROXY: "false", TRUSTED_PROXY_HEADER: SECRET_HEADER_VALUE });
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(captured.length, 1);
  });
});

describe("validateProxyEnv — invalid values with trust enabled", () => {
  it("throws instead of silently degrading to another header", () => {
    const warnings: string[] = [];
    assert.throws(
      () =>
        validateProxyEnv(
          { TRUSTED_PROXY: "true", TRUSTED_PROXY_HEADER: SECRET_HEADER_VALUE },
          { warn: (message) => warnings.push(message) },
        ),
      EnvConfigurationError,
    );
    assert.deepEqual(warnings, [], "no warning is emitted when the error is fatal");
  });

  it("throws for surrounding whitespace", () => {
    assert.throws(
      () => validateProxyEnv({ TRUSTED_PROXY: "true", TRUSTED_PROXY_HEADER: " x-real-ip" }, { warn: () => {} }),
      EnvConfigurationError,
    );
  });

  it("throws for an invalid TRUSTED_PROXY regardless of the header", () => {
    assert.throws(
      () => validateProxyEnv({ TRUSTED_PROXY: "TRUE", TRUSTED_PROXY_HEADER: "x-real-ip" }, { warn: () => {} }),
      (error: unknown) => {
        assert.ok(error instanceof EnvConfigurationError);
        assert.equal(error.variable, "TRUSTED_PROXY");
        return true;
      },
    );
  });

  it("reports TRUSTED_PROXY before the header when both are invalid", () => {
    assert.throws(
      () =>
        validateProxyEnv(
          { TRUSTED_PROXY: SECRET_PROXY_VALUE, TRUSTED_PROXY_HEADER: SECRET_HEADER_VALUE },
          { warn: () => {} },
        ),
      (error: unknown) => {
        assert.ok(error instanceof EnvConfigurationError);
        assert.equal(error.variable, "TRUSTED_PROXY");
        return true;
      },
    );
  });
});

// ============================================================
// Parity with extractClientIp (NOT modified by this change)
// ============================================================

describe("default parity with extractClientIp", () => {
  it("agrees that an unset TRUSTED_PROXY means no trust", () => {
    const envObj = process.env as Record<string, string | undefined>;
    const origNodeEnv = envObj.NODE_ENV;
    try {
      envObj.NODE_ENV = "production";
      const parsed = withProxyEnv({}, () => parseTrustedProxy(process.env.TRUSTED_PROXY));
      assert.equal(parsed, false);
      assert.throws(
        () =>
          withProxyEnv({}, () =>
            extractClientIp({ headers: makeFakeHeaders({ "x-forwarded-for": "203.0.113.10" }) }),
          ),
        ProxyConfigurationError,
        "unset TRUSTED_PROXY must behave exactly like false",
      );
    } finally {
      envObj.NODE_ENV = origNodeEnv;
    }
  });

  it("agrees on x-forwarded-for as the default header", () => {
    assert.equal(parseTrustedProxyHeader(undefined), "x-forwarded-for");

    const ip = withProxyEnv({}, () =>
      extractClientIp({ headers: makeFakeHeaders({ "x-forwarded-for": "203.0.113.11" }) }, true),
    );
    assert.equal(ip, "203.0.113.11");
  });

  it("agrees that x-real-ip is NOT the default header", () => {
    assert.equal(parseTrustedProxyHeader(undefined), "x-forwarded-for");
    assert.throws(
      () =>
        withProxyEnv({}, () =>
          extractClientIp({ headers: makeFakeHeaders({ "x-real-ip": "203.0.113.12" }) }, true),
        ),
      ProxyConfigurationError,
      "extractClientIp must keep looking for x-forwarded-for by default",
    );
  });

  it("agrees on the headers the trust rules support", () => {
    for (const header of TRUSTED_PROXY_HEADERS) {
      assert.equal(parseTrustedProxyHeader(header), header);
      const ip = withProxyEnv({ TRUSTED_PROXY_HEADER: header }, () =>
        extractClientIp({ headers: makeFakeHeaders({ [header]: "203.0.113.13" }) }, true),
      );
      assert.equal(ip, "203.0.113.13", `${header} must stay usable by extractClientIp`);
    }
  });
});
