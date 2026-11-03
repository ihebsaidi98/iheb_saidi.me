/**
 * src/lib/env-config.ts
 *
 * H3-3 / H3-4 — proxy environment validation.
 *
 * Purpose: reject an unusable `TRUSTED_PROXY` / `TRUSTED_PROXY_HEADER` with an
 * explicit message instead of degrading silently at request time. Today an
 * unusable `TRUSTED_PROXY` (e.g. `TRUE`) falls back to `false` and every
 * rate-limited route answers 500 `IP_VERIFICATION_FAILED` in production with no
 * hint about the cause, and an unusable `TRUSTED_PROXY_HEADER` is only detected
 * once `extractClientIp` runs.
 *
 * Rules (deliberately aligned with what `extractClientIp` in ./chat actually
 * understands, so this module can never validate a configuration that the
 * runtime would then refuse):
 *
 *   TRUSTED_PROXY
 *     - unset or ""                 -> false (unchanged default, fail closed)
 *     - exactly "true"              -> true
 *     - exactly "false"             -> false
 *     - anything else               -> EnvConfigurationError
 *       No trim, no case folding: "TRUE", "true ", "1", "yes", "on" are errors
 *       rather than a silent fallback to "no proxy".
 *
 *   TRUSTED_PROXY_HEADER
 *     - unset                       -> "x-forwarded-for" (header written by nginx)
 *     - the three supported headers, case-insensitive, normalised to lower case
 *     - surrounding whitespace      -> EnvConfigurationError (chat.ts does not
 *       trim either, so trimming here would validate a value it still rejects)
 *     - anything else               -> EnvConfigurationError
 *     - fatal only when TRUSTED_PROXY is enabled; otherwise a single warning,
 *       because the variable is inert in that mode and a hard failure would
 *       reject configurations that work today.
 *
 * This module is pure: it never reads `process.env` itself and has no side
 * effect at import time. The environment is passed in, which keeps it testable
 * without a server and importable from the Next.js instrumentation hook.
 */

/** Headers guaranteed by a reverse proxy that `extractClientIp` supports. */
export const TRUSTED_PROXY_HEADERS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] as const;

/** Header the bundled nginx writes (`nginx/nginx.conf`). */
export const DEFAULT_TRUSTED_PROXY_HEADER: (typeof TRUSTED_PROXY_HEADERS)[number] = "x-forwarded-for";

export type TrustedProxyHeader = (typeof TRUSTED_PROXY_HEADERS)[number];

const ALLOWED_HEADERS = TRUSTED_PROXY_HEADERS.map((header) => `"${header}"`).join(", ");

/**
 * Configuration error raised during validation.
 *
 * The received value is never included in the message: it is deployment input
 * that ends up in container logs, and the allowlist is enough to fix the
 * problem. `variable` names the offending variable only.
 */
export class EnvConfigurationError extends Error {
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = "EnvConfigurationError";
    this.variable = variable;
  }
}

/**
 * Resolve `TRUSTED_PROXY`.
 *
 * Absent and empty both mean "no proxy trust", which is the historical and
 * fail-closed default: an absent variable must stay valid for `npm test`,
 * `next start` without a generated env file, and E2E runs.
 */
export function parseTrustedProxy(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  if (raw === "true") return true;
  if (raw === "false") return false;

  throw new EnvConfigurationError(
    "TRUSTED_PROXY",
    'Invalid TRUSTED_PROXY: only the exact values "true" or "false" are accepted ' +
      "(case-sensitive, without surrounding whitespace); unset or empty means \"false\". " +
      "The received value is intentionally not echoed.",
  );
}

/**
 * Resolve `TRUSTED_PROXY_HEADER`.
 *
 * Case is ignored, mirroring the `.toLowerCase()` used by `extractClientIp`;
 * surrounding whitespace is rejected because that function does not trim.
 */
export function parseTrustedProxyHeader(raw: string | undefined): TrustedProxyHeader {
  if (raw === undefined) return DEFAULT_TRUSTED_PROXY_HEADER;

  if (raw.trim() !== raw) {
    throw new EnvConfigurationError(
      "TRUSTED_PROXY_HEADER",
      `Invalid TRUSTED_PROXY_HEADER: surrounding whitespace is not allowed; expected one of ${ALLOWED_HEADERS} (case-insensitive). ` +
        "The received value is intentionally not echoed.",
    );
  }

  const normalized = raw.toLowerCase();
  if ((TRUSTED_PROXY_HEADERS as readonly string[]).includes(normalized)) {
    return normalized as TrustedProxyHeader;
  }

  throw new EnvConfigurationError(
    "TRUSTED_PROXY_HEADER",
    `Invalid TRUSTED_PROXY_HEADER: expected one of ${ALLOWED_HEADERS} (case-insensitive); unset means "${DEFAULT_TRUSTED_PROXY_HEADER}". ` +
      "The received value is intentionally not echoed.",
  );
}

/** Resolved proxy configuration. */
export interface ProxyEnv {
  readonly trustedProxy: boolean;
  readonly trustedProxyHeader: TrustedProxyHeader;
}

export interface ValidateProxyEnvOptions {
  /** Sink for the non-fatal warning; defaults to `console.warn`. */
  readonly warn?: (message: string) => void;
}

/**
 * Validate the proxy variables once, before any rate-limited request is served.
 *
 * `TRUSTED_PROXY` is always fatal when invalid. `TRUSTED_PROXY_HEADER` is fatal
 * only when proxy trust is enabled; otherwise it cannot influence any request,
 * so a warning is emitted (without the value) and the default header is
 * returned for reporting purposes.
 */
export function validateProxyEnv(
  env: Record<string, string | undefined>,
  options: ValidateProxyEnvOptions = {},
): ProxyEnv {
  const warn = options.warn ?? ((message: string) => console.warn(message));

  // Fatal regardless of the header: the mode itself is unusable.
  const trustedProxy = parseTrustedProxy(env.TRUSTED_PROXY);

  let trustedProxyHeader: TrustedProxyHeader;
  try {
    trustedProxyHeader = parseTrustedProxyHeader(env.TRUSTED_PROXY_HEADER);
  } catch (error) {
    if (trustedProxy || !(error instanceof EnvConfigurationError)) throw error;
    warn(
      `[env-config] ${error.message} TRUSTED_PROXY is not enabled, so TRUSTED_PROXY_HEADER is inert; ` +
        `falling back to "${DEFAULT_TRUSTED_PROXY_HEADER}".`,
    );
    trustedProxyHeader = DEFAULT_TRUSTED_PROXY_HEADER;
  }

  return { trustedProxy, trustedProxyHeader };
}
