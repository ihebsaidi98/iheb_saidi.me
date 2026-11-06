# Iheb Saidi Portfolio

This repository contains the current Next.js portfolio for Iheb Saidi, a full-stack software engineer focused on Java, Spring Boot, Angular, and production-grade backend/frontend systems.

## Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Three.js for the hero 3D scene
- custom client-side enhancements for motion and smooth scrolling

## Environment Setup

### Security Warning: Never Paste API Keys in Chat or Prompts
> [!CAUTION]
> **Never paste your real API keys in chat prompts, issue trackers, or code commits.**
> LLM providers and web assistants may log conversations or expose prompts. Secrets committed to git can be indexed and compromised within seconds. Always store keys in ignored local environment files (`.env.local` and `ai-service/.env`).

### Setup Procedure

1. **Automated Internal Token Generation:**
   Run the setup script from the project root:
   ```bash
   python3 scripts/setup-env.py
   ```
   This script securely generates a cryptographic internal token (`secrets.token_urlsafe(32)`) and configures both `.env.local` (frontend) and `ai-service/.env` (FastAPI backend) with matching `AI_SERVICE_TOKEN` values.

2. **Add Your Gemini API Key Manually:**
   - Obtain an API key from Google AI Studio: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   - Expected format: Starts with `AIza` and contains exactly 39 characters.
   - Open both `.env.local` and `ai-service/.env` in your editor.
   - Replace the placeholder `AIza...PASTE_YOUR_REAL_KEY_HERE` with your actual key.
   - **The Gemini key must be identical in both files.**

3. **Restart Services:**
   - Always restart both the frontend (`npm run dev`) and backend (`ai-service`) or Docker containers (`docker compose restart`) after modifying any `.env*` file for changes to take effect.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Docker Quickstart

Start both the Next.js frontend (`localhost:3000`) and the FastAPI AI microservice (`localhost:8001`, which maps to the container's port `8000`) with a single command:

1. **Configure Environment Variables:**
   ```bash
   python3 scripts/setup-env.py
   ```
   > [!IMPORTANT]
   > **Shared Internal Secret**: The `AI_SERVICE_TOKEN` value configured in `.env.local` and `ai-service/.env` **must match exactly**. Next.js transmits this token in the `X-Internal-Token` header for server-to-server proxy calls to the FastAPI service. Also make sure to set your real `GEMINI_API_KEY`.

   > [!NOTE]
   > **Proxy trust in Docker**: `docker-compose.yml` sets `TRUSTED_PROXY=true` and `TRUSTED_PROXY_HEADER=x-forwarded-for` for the `frontend` service. Compose `environment` always overrides `env_file`, so the `TRUSTED_PROXY=false` that `setup-env.py` writes for direct development cannot leak into the proxy stack. Keep `TRUSTED_PROXY=false` only when `npm run dev` is reached directly, without Nginx.

2. **Build and Start Services:**
   ```bash
   docker compose up --build
   ```

3. **Access Applications:**
   - Frontend Portfolio: [http://localhost:3000](http://localhost:3000)
   - FastAPI Health Check: `curl http://localhost:8001/health/ready` (or `curl http://localhost:8001/health/live`)

     `/health/*` is **unauthenticated by design** and returns deployment metadata (environment, version, index statistics), so the Compose stack publishes it on `127.0.0.1` only — never behind a public interface. The public monitoring endpoint is `GET /api/ai/health`, which exposes the readiness verdict alone.

4. **Stop Services:**
   ```bash
   docker compose down
   ```


## Project structure

- src/app — app shell, global styles, metadata, and route files
- src/components — reusable UI and visual enhancements
- src/sections — portfolio sections
- src/data — profile, experience, education, and project data
- public/images — project screenshots used by the portfolio

## AI Chatbot & RAG Knowledge Base

The portfolio includes an AI chatbot grounded on Iheb Saidi's verified background using Google Gemini (`@google/genai`) and a precomputed vector index (`src/data/rag-index.json`).

### Precomputing the Knowledge Base Index

The document embeddings are precomputed into `src/data/rag-index.json` using `gemini-embedding-001` (768 dimensions), so the server never needs to re-embed knowledge chunks on incoming user messages.

**When to rerun `npm run index:kb`:**
- Whenever files in `src/data/` (`profile.ts`, `experience.ts`, `projects.ts`, `about.ts`, `education.ts`, `site.ts`) are edited.
- Whenever documents in `src/lib/knowledge-base.ts` are added, modified, or rephrased.
- Whenever the embedding model or target dimensionality configuration is changed.

```bash
npm run index:kb
```

## Security & Rate Limiting Configuration

### Environment Variables

The defaults below are the values baked into the code, so an unset variable behaves exactly as documented. For a ready-to-copy starting point use `.env.example` (direct development) or `python3 scripts/setup-env.py`.

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(none)* | Server-side Gemini key. Never sent to the browser. |
| `GEMINI_CHAT_MODEL` | `gemini-3.5-flash-lite` | Chat model; an unavailable model falls back through the candidate list in `src/app/api/chat/route.ts`. |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model used by `npm run index:kb` (768 dimensions). |
| `AI_SERVICE_URL` | *(none)* | Base URL of the FastAPI service (`http://localhost:8001` locally). |
| `AI_SERVICE_TOKEN` | *(none — required)* | Shared secret with the FastAPI service. There is no built-in default; while it is empty, delegation is not attempted and the interview endpoints answer `503 SERVICE_UNAVAILABLE`. |
| `AI_SERVICE_ENABLED` | *(enabled)* | Kill switch for server-to-server delegation. Only the literal `"false"` disables it; any other value, or leaving it unset, keeps it enabled. |
| `CHAT_RATE_LIMIT` | `10` | Requests allowed per window on `POST /api/chat`. |
| `CHAT_RATE_WINDOW_MS` | `60000` | Chat rate-limit window, in milliseconds. |
| `INTERVIEW_RATE_LIMIT` | `15` | Requests allowed per window, counted independently on `/api/interview/start` and `/api/interview/submit`. |
| `INTERVIEW_RATE_WINDOW_MS` | `60000` | Interview start and submit rate-limit window, in milliseconds. |
| `INTERVIEW_COMPLETE_RATE_LIMIT` | `2` | Requests allowed per window on `POST /api/interview/complete` (evaluates written answers via Gemini; throttled to prevent batch burst evaluations). |
| `INTERVIEW_COMPLETE_RATE_WINDOW_MS` | `60000` | Interview completion rate-limit window, in milliseconds. |
| `TECH_NEWS_RATE_LIMIT` | `30` | Requests allowed per window on `GET /api/tech-news`. |
| `TECH_NEWS_RATE_WINDOW_MS` | `60000` | Tech-news rate-limit window, in milliseconds. |
| `CSP_REPORT_RATE_LIMIT` | `60` | Requests allowed per window on `POST /api/csp-report`. |
| `CSP_REPORT_RATE_WINDOW_MS` | `60000` | CSP-report rate-limit window, in milliseconds. |
| `AI_HEALTH_RATE_LIMIT` | `60` | Requests allowed per window on `GET /api/ai/health`. |
| `AI_HEALTH_RATE_WINDOW_MS` | `60000` | AI-health rate-limit window, in milliseconds. |
| `LLM_TIMEOUT_MS` | `45000` | Upper bound for a single Gemini call; exceeding it answers `504 TIMEOUT`. |
| `TRUSTED_PROXY` | `false` | Proxy trust mode, detailed below. |
| `TRUSTED_PROXY_HEADER` | `x-forwarded-for` | Header trusted when `TRUSTED_PROXY=true`; also accepts `x-real-ip` or `cf-connecting-ip`. |
| `DEV_TO_API_KEY` | *(none)* | Optional key for the tech-news section. |

All rate limiters use an in-memory Sliding Window Counter (SWC) with a two-bucket linear decay approximation over an epoch-aligned window ($T$, default 60 seconds). For a nominal limit $L$, the limiter estimates the rolling load as $N_{\text{est}} = \text{curCount} + \text{prevCount} \times (1 - \text{age}/T)$ and rejects with HTTP 429 when $N_{\text{est}} \ge L$ before incrementing `curCount`. Because this integer approximation checks load before incrementing and spans two epoch buckets, an adversarial burst crossing an epoch boundary can admit up to $2 \times L$ requests within a rolling interval shorter than $T$: for `INTERVIEW_COMPLETE_RATE_LIMIT=2`, two requests at $t = 59.9\,\text{s}$ and two requests at $t = 90.1\,\text{s}$ ($\text{age} > 30\,\text{s}$) are both admitted, yielding up to **4 accepted completions in ~30 seconds** before the 5th request is blocked. Each interview completion evaluates up to 5 open-ended written answers via Gemini, so this peak boundary burst bounds downstream AI evaluations to at most **20 Gemini calls** on that interval (down from 75+ previously under the shared limit of 15). A rate-limit value that is missing, empty, non-numeric, zero or negative falls back to the defaults above (`parseEnvInt` in `src/lib/rate-limit-config.ts`): a typo never disables limiting. Parsing is strict — only plain decimal digits are accepted after trimming, so `10abc`, `1e3`, `10.5`, `+10` and `1_000` fall back to the default instead of being truncated to `10`, `1`, `10`, `10` and `1`.

`POST /api/csp-report` additionally caps its body at **16 KiB** (`MAX_CSP_REPORT_BYTES` in `src/app/api/csp-report/route.ts`): the `Content-Length` header is rejected early with `413 PAYLOAD_TOO_LARGE`, and the stream is still counted byte by byte, so a chunked request or a lying `Content-Length` cannot make the handler accumulate more than 16 KiB of text — plus the single chunk that crossed the cap before the read was cancelled. `GET /api/tech-news` remains public but counts against `TECH_NEWS_RATE_LIMIT`, and an over-quota request returns `429 RATE_LIMITED` without touching the feed cache or any external feed.

### Cross-Origin Requests on Mutating Endpoints

The five mutating routes — `POST /api/chat`, `/api/csp-report`, `/api/interview/start`, `/api/interview/submit` and `/api/interview/complete` — run `rejectCrossOriginRequest()` (`src/lib/request-origin.ts`) as their first statement and answer `403 CROSS_ORIGIN_REJECTED` when a browser says the request was initiated by another site:

| Signal | Decision |
|---|---|
| `Sec-Fetch-Site: cross-site` (or the legacy `simple-http-context`) | rejected, even if `Origin` claims this host |
| `Sec-Fetch-Site: same-origin` or `none` | allowed |
| `Sec-Fetch-Site: same-site`, or an unknown value | decided by `Origin` |
| `Origin` present | its hostname must equal the hostname this app answers on |
| `Origin: null` | rejected (sandboxed iframe, `file://`, some redirect chains) |
| `Origin` malformed, with a path/credentials, or not `http(s)` | rejected |
| `Origin` absent, `Referer` present | the `Referer` hostname must match |
| `Origin` and `Referer` absent | allowed |

Only the **hostname** is compared, not the full origin, because the two supported deployments legitimately change the other parts: the bundled Nginx forwards `Host $host` (no port) while the browser sends `Origin: http://localhost:3000`, and a TLS terminator in front of the app makes the app see `http://` where the browser sends `https://`. A deployment serving the frontend from a *different hostname* is not supported by this policy and would need an explicit allowlist.

Requests carrying no browser metadata at all are allowed on purpose: `curl`, monitoring probes, CI and the Next.js → FastAPI server-to-server calls send no `Origin`, and no browser is involved to forge from. Read-only handlers are untouched — `GET /api/tech-news` stays public and the wrong-method `405`s stay `405`, since no CORS header is ever emitted and cross-origin JavaScript cannot read those responses anyway. There is also no browser credential to ride here (no cookie, no `Authorization` header): the protection is against *forgery without credentials* — a hostile page burning the owner's LLM credits through a preflight-free `text/plain` or form-encoded POST.

The rejection happens **before** the rate limiter, so a hostile page cannot exhaust a real visitor's quota; a `403 CROSS_ORIGIN_REJECTED` therefore carries no `X-RateLimit-*` header, exactly like every other pre-quota rejection. The status, the JSON `code` and every other existing error contract (`413`, `415`, `422`, `429`, `503`, `TOKEN_MISMATCH`) are unchanged.

### Reverse Proxy & Client IP Verification (`TRUSTED_PROXY`)

The `/api/chat` route applies rate limiting based on the client IP address. To protect against IP spoofing:

- **`TRUSTED_PROXY=false` (Default)**: Direct client mode. Every client-supplied header (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`) is strictly ignored. The only accepted source is the runtime socket IP (`request.ip`), plus a loopback fallback (`127.0.0.1`) in development/test. **`request.ip` no longer exists on `NextRequest` in Next.js 15**, so in production this mode fails closed with HTTP 500 `IP_VERIFICATION_FAILED`. It is usable for local development and tests only; production must run behind a trusted proxy with `TRUSTED_PROXY=true`.
- **`TRUSTED_PROXY=true`**: Reverse proxy mode. **Must only be activated when deployed behind a verified reverse proxy** (such as Vercel Edge Network, Cloudflare, or an Nginx/HAProxy reverse proxy configured to strictly sanitize and append client IPs). Only the header named by `TRUSTED_PROXY_HEADER` is read — `x-forwarded-for` (default), `x-real-ip`, or `cf-connecting-ip`; the other headers are never consulted. For `x-forwarded-for` the limiter uses the *last* segment (the trusted hop added by your reverse proxy), never a client-controllable prefix segment.

**Bundled Nginx proxy (`docker-compose.yml`, `nginx/nginx.conf`).** In the Compose stack the bundled Nginx is the only trust boundary, and it enforces the contract above:

- It overwrites `X-Forwarded-For` and `X-Real-IP` with `$remote_addr` (the TCP peer it sees) and deletes the CDN headers it does not use (`CF-Connecting-IP`, `True-Client-IP`, `X-Cluster-Client-IP`). A client-supplied chain therefore never reaches the app. This is why `x-forwarded-for` is the only value that works with this configuration: selecting `cf-connecting-ip` fails closed with HTTP 500 `IP_VERIFICATION_FAILED`, because the header is stripped before it reaches the app.
- The configuration contains no `real_ip_header` / `set_real_ip_from` directive, so the Nginx realip module is inert and `$remote_addr` stays the direct peer address. **Behind a CDN or a load balancer, that peer is the CDN/load-balancer node, not the visitor**: every visitor then shares one rate-limit key, so the per-IP quotas (`CHAT_RATE_LIMIT`, `INTERVIEW_RATE_LIMIT`) become a single shared quota per proxy node and legitimate traffic can receive `429 RATE_LIMITED` as a whole. Fixing that requires resolving the client address at the proxy (`set_real_ip_from` + `real_ip_header` + `real_ip_recursive`, restricted to the provider's published ranges) **and** restricting origin access to that provider — otherwise a caller could reach the origin directly and forge the header. Both are deployment decisions and are intentionally not configured in this repository.
- Direct access (the Compose stack as shipped, with no intermediary) is unaffected: the quotas stay per client.

In both modes the selected value is validated and normalized before being used as the rate-limit key (`normalizeClientIp()`): IPv4/IPv6 literals only, IPv6 canonicalized so equivalent notations share one key, IPv4-mapped IPv6 (`::ffff:192.0.2.1`) reduced to plain IPv4, well-formed IPv6 zone ids stripped. Empty, over-long (more than 45 characters), malformed values, values carrying a port (`1.2.3.4:80`), and the RFC 7239 `unknown` token are rejected. A rejected value fails closed with `ProxyConfigurationError` (HTTP 500): it is never replaced by a placeholder key, and the limiter never falls back to another `X-Forwarded-For` segment. This prevents notation-based key rotation from multiplying quotas. The limiter key is then derived with `clientIpRateLimitKey()`: global unicast IPv6 (`2000::/3`) is grouped by `/64` in canonical form, so a client rotating source addresses inside one delegated prefix consumes a single quota. IPv4, IPv4-mapped IPv6, loopback, link-local, ULA, and the `2002::/16` (6to4), `2001::/32` (Teredo) and `64:ff9b::/96` (NAT64) transition prefixes keep their full address, because grouping them would merge unrelated clients. A client that controls several `/64` blocks still multiplies its quota — a `/56` yields 256 buckets, a `/48` 65,536 — so this mitigates rotation within one subscriber prefix, it does not eliminate prefix rotation.

### HTTPS Termination & HSTS (`Strict-Transport-Security`)

**TLS is not terminated in this repository.** `docker-compose.yml` publishes the bundled Nginx as `"3000:80"`, and `nginx/nginx.conf` declares only `listen 80` / `listen [::]:80` — no `listen 443`, no `ssl_certificate`, no ACME client. As shipped, the stack serves plain HTTP end to end. If the site is reachable over HTTPS, the certificate and the handshake belong to a component in front of it (host reverse proxy, cloud load balancer, CDN, tunnel), which this repository neither configures nor can inspect.

Consequently **no layer here emits `Strict-Transport-Security`**, and that is deliberate:

- **Browsers ignore HSTS received over plain HTTP**, so adding it to a port-80 response achieves nothing but makes the configuration look protected.
- **The bundled Nginx cannot tell whether the public hop was HTTPS.** It overwrites `X-Forwarded-Proto` with `$scheme`, and `$scheme` is `http` on its only listener, so an upstream terminator's value is discarded before the app sees it. Reading a client-supplied `X-Forwarded-Proto` instead would let any caller dictate security headers and would contradict the IP trust boundary described above.
- **`next.config.mjs` headers are static** for `/:path*`: they cannot vary per request scheme, so an HSTS entry there would also be served on plain-HTTP origins such as `http://localhost:3000`.

CSP `upgrade-insecure-requests` (already enforced in the production policy) upgrades subresource requests, but it does not replace HSTS: only HSTS stops the very first request from going out over HTTP.

**Where HSTS belongs.** Configure it on the component that actually terminates TLS, on HTTPS responses only:

```http
Strict-Transport-Security: max-age=31536000
```

Policy rules for that value:

- `max-age=31536000` (one year), applied to every HTTPS response, not only the homepage.
- **No `includeSubDomains`**: this repository cannot guarantee that every subdomain of the apex domain is HTTPS-only, and one year of HSTS on HTTP-only subdomains is not something a visitor can undo.
- **No `preload`**: preload commits the whole domain to browser preload lists, requires submission, and cannot be reversed quickly.
- Send the header **only when the request was actually HTTPS**, and do not rely on it as a redirect: keep the HTTP→HTTPS redirect at the terminator as well.

If TLS termination ever moves into this repository (a 443 `server` block with certificates), the header belongs in that block, under the same rules. Until then, the decision is recorded by the guard tests in `src/lib/config-consistency.test.ts` and the runtime assertion in `e2e/security-headers.spec.ts`: they fail if an HSTS header appears without a deliberate TLS change.

## Notes

- The active project system is the current professional experience and academic project implementations in the app.
- Legacy duplicated project-card and UI code has been removed in favor of the active implementation.
- Metadata and sitemap are configured for the live domain: https://iheb-saidi.dev
