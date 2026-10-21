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

### Reverse Proxy & Client IP Verification (`TRUSTED_PROXY`)

The `/api/chat` route applies rate limiting based on the client IP address. To protect against IP spoofing:

- **`TRUSTED_PROXY=false` (Default)**: Direct client mode. `X-Forwarded-For` is strictly ignored to prevent attackers from spoofing their IP address. The rate limiter relies directly on `request.ip` or `X-Real-IP`.
- **`TRUSTED_PROXY=true`**: Reverse proxy mode. **Must only be activated when deployed behind a verified reverse proxy** (such as Vercel Edge Network, Cloudflare, or an Nginx/HAProxy reverse proxy configured to strictly sanitize and append client IPs). In this mode, the rate limiter inspects the *last* segment of `X-Forwarded-For` (the trusted hop added by your reverse proxy) rather than client-controllable prefix segments.

## Notes

- The active project system is the current professional experience and academic project implementations in the app.
- Legacy duplicated project-card and UI code has been removed in favor of the active implementation.
- Metadata and sitemap are configured for the live domain: https://iheb-saidi.dev
