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

Start both the Next.js frontend (`localhost:3000`) and the FastAPI AI microservice (`localhost:8000`) with a single command:

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
   - FastAPI Health Check: `curl http://localhost:8000/health` (or `curl http://localhost:8000/health/ready`)

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
| `INTERVIEW_RATE_LIMIT` | `15` | Requests allowed per window, counted independently on each `/api/interview/*` route. |
| `INTERVIEW_RATE_WINDOW_MS` | `60000` | Interview rate-limit window, in milliseconds. |
| `TECH_NEWS_RATE_LIMIT` | `30` | Requests allowed per window on `GET /api/tech-news`. |
| `TECH_NEWS_RATE_WINDOW_MS` | `60000` | Tech-news rate-limit window, in milliseconds. |
| `CSP_REPORT_RATE_LIMIT` | `60` | Requests allowed per window on `POST /api/csp-report`. |
| `CSP_REPORT_RATE_WINDOW_MS` | `60000` | CSP-report rate-limit window, in milliseconds. |
| `LLM_TIMEOUT_MS` | `45000` | Upper bound for a single Gemini call; exceeding it answers `504 TIMEOUT`. |
| `TRUSTED_PROXY` | `false` | Proxy trust mode, detailed below. |
| `TRUSTED_PROXY_HEADER` | `x-forwarded-for` | Header trusted when `TRUSTED_PROXY=true`; also accepts `x-real-ip` or `cf-connecting-ip`. |
| `DEV_TO_API_KEY` | *(none)* | Optional key for the tech-news section. |

A rate-limit value that is missing, empty, non-numeric, zero or negative falls back to the default above (`parseEnvInt` in `src/lib/rate-limit-config.ts`): a typo never disables limiting.

`POST /api/csp-report` additionally caps its body at **16 KiB** (`MAX_CSP_REPORT_BYTES` in `src/app/api/csp-report/route.ts`): the `Content-Length` header is rejected early with `413 PAYLOAD_TOO_LARGE`, and the stream is still counted byte by byte, so a chunked request or a lying `Content-Length` cannot force the process to buffer more than 16 KiB. `GET /api/tech-news` remains public but counts against `TECH_NEWS_RATE_LIMIT`, and an over-quota request returns `429 RATE_LIMITED` without touching the feed cache or any external feed.

### Reverse Proxy & Client IP Verification (`TRUSTED_PROXY`)

The `/api/chat` route applies rate limiting based on the client IP address. To protect against IP spoofing:

- **`TRUSTED_PROXY=false` (Default)**: Direct client mode. Every client-supplied header (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`) is strictly ignored. The only accepted source is the runtime socket IP (`request.ip`), plus a loopback fallback (`127.0.0.1`) in development/test. **`request.ip` no longer exists on `NextRequest` in Next.js 15**, so in production this mode fails closed with HTTP 500 `IP_VERIFICATION_FAILED`. It is usable for local development and tests only; production must run behind a trusted proxy with `TRUSTED_PROXY=true`.
- **`TRUSTED_PROXY=true`**: Reverse proxy mode. **Must only be activated when deployed behind a verified reverse proxy** (such as Vercel Edge Network, Cloudflare, or an Nginx/HAProxy reverse proxy configured to strictly sanitize and append client IPs). Only the header named by `TRUSTED_PROXY_HEADER` is read — `x-forwarded-for` (default), `x-real-ip`, or `cf-connecting-ip`; the other headers are never consulted. For `x-forwarded-for` the limiter uses the *last* segment (the trusted hop added by your reverse proxy), never a client-controllable prefix segment.

**Bundled Nginx proxy (`docker-compose.yml`, `nginx/nginx.conf`).** In the Compose stack the bundled Nginx is the only trust boundary, and it enforces the contract above:

- It overwrites `X-Forwarded-For` and `X-Real-IP` with `$remote_addr` (the TCP peer it sees) and deletes the CDN headers it does not use (`CF-Connecting-IP`, `True-Client-IP`, `X-Cluster-Client-IP`). A client-supplied chain therefore never reaches the app. This is why `x-forwarded-for` is the only value that works with this configuration: selecting `cf-connecting-ip` fails closed with HTTP 500 `IP_VERIFICATION_FAILED`, because the header is stripped before it reaches the app.
- The configuration contains no `real_ip_header` / `set_real_ip_from` directive, so the Nginx realip module is inert and `$remote_addr` stays the direct peer address. **Behind a CDN or a load balancer, that peer is the CDN/load-balancer node, not the visitor**: every visitor then shares one rate-limit key, so the per-IP quotas (`CHAT_RATE_LIMIT`, `INTERVIEW_RATE_LIMIT`) become a single shared quota per proxy node and legitimate traffic can receive `429 RATE_LIMITED` as a whole. Fixing that requires resolving the client address at the proxy (`set_real_ip_from` + `real_ip_header` + `real_ip_recursive`, restricted to the provider's published ranges) **and** restricting origin access to that provider — otherwise a caller could reach the origin directly and forge the header. Both are deployment decisions and are intentionally not configured in this repository.
- Direct access (the Compose stack as shipped, with no intermediary) is unaffected: the quotas stay per client.

In both modes the selected value is validated and normalized before being used as the rate-limit key (`normalizeClientIp()`): IPv4/IPv6 literals only, IPv6 canonicalized so equivalent notations share one key, IPv4-mapped IPv6 (`::ffff:192.0.2.1`) reduced to plain IPv4, well-formed IPv6 zone ids stripped. Empty, over-long (more than 45 characters), malformed values, values carrying a port (`1.2.3.4:80`), and the RFC 7239 `unknown` token are rejected. A rejected value fails closed with `ProxyConfigurationError` (HTTP 500): it is never replaced by a placeholder key, and the limiter never falls back to another `X-Forwarded-For` segment. This prevents key rotation from multiplying quotas; it does not aggregate IPv6 prefixes (no `/64` grouping), so per-address limiting still does not constrain an attacker rotating through a delegated IPv6 prefix.

## Notes

- The active project system is the current professional experience and academic project implementations in the app.
- Legacy duplicated project-card and UI code has been removed in favor of the active implementation.
- Metadata and sitemap are configured for the live domain: https://iheb-saidi.dev
