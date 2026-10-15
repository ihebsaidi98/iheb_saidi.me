# Portfolio AI Service (Python)

A production-grade Python AI Service built with **FastAPI**, **Pydantic Settings**, and the official **Google GenAI SDK** (`google-genai`), managed hermetically with **Astral `uv`**.

This service serves as the core engine for the unified AI platform:
- **Phase 1 (Current)**: Resilient service foundation, health probes, versioned `/v1` APIs, internal server-to-server auth, request ID correlation, structured errors, and Next.js proxy foundation.
- **Phase 2 (Upcoming)**: High-performance Python semantic retrieval over the existing precomputed RAG index (`src/data/rag-index.json`).
- **Phase 3 (Upcoming)**: Agentic RAG, Career Copilot, adaptive interview simulator, and automated RAG evaluation.

---

## 1. Architecture & Design Principles

```
Next.js App Router (Port 3000)
    │
    │  (Server-to-server HTTP with X-Internal-Token & X-Request-ID)
    ▼
FastAPI AI Service (Port 8000)
    ├── /health/live        (Unauthenticated liveness probe)
    ├── /health/ready       (Unauthenticated readiness probe)
    └── /v1/*               (Protected by constant-time token verification)
         └── /v1/info       (Platform capabilities and model status)
```

- **Zero Client Secret Exposure**: Browser requests communicate strictly with Next.js App Router. The browser never receives `GEMINI_API_KEY` or `AI_SERVICE_TOKEN`.
- **Strict Boundary Security**: All internal routes under `/v1/` require an internal token validated via `secrets.compare_digest` in constant time.
- **Fail-Fast Configuration**: Settings are validated at application startup using Pydantic Settings.
- **Request ID Tracking**: All requests carry or generate an `X-Request-ID` header, propagated through logging contexts and responses without leaking user prompt payloads.
- **Payload & Latency Protection**: Enforces a strict 1MB body limit (`413 Payload Too Large`) and 15s bounded timeouts with async retries.

---

## 2. Environment Variables

Create `.env` or set environment variables in your deployment environment:

| Variable | Type | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Secret | `""` | Google Gemini API key for embeddings and generation |
| `GEMINI_CHAT_MODEL` | String | `gemini-3.5-flash-lite` | Active Gemini chat model |
| `GEMINI_EMBEDDING_MODEL` | String | `gemini-embedding-001` | Active Gemini embedding model (768 dimensions) |
| `AI_SERVICE_TOKEN` | Secret | *(dev fallback)* | Shared secret for server-to-server Next.js authentication |
| `ENVIRONMENT` | String | `development` | Environment mode (`development`, `test`, `production`) |
| `HOST` | String | `127.0.0.1` | Bind host |
| `PORT` | Integer | `8000` | Bind port |
| `ALLOWED_ORIGINS` | String/List | `http://localhost:3000,http://127.0.0.1:3000` | Allowed CORS origins |
| `REQUEST_TIMEOUT_SECONDS` | Float | `15.0` | Default timeout for external requests |
| `MAX_REQUEST_SIZE_BYTES` | Integer | `1048576` | Maximum request body size (1MB) |

---

## 3. Local Development

### Prerequisites
- Python 3.12+ (automatically managed by `uv`)
- `uv` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Installing Dependencies
```bash
cd ai-service
uv sync
```

### Running the Development Server
From the project root:
```bash
npm run ai:dev
# or directly from ai-service:
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Running Tests
All tests are 100% offline and use mocked providers:
```bash
npm run ai:test
# or:
uv run pytest
```

### Linting and Formatting
```bash
npm run ai:lint
# or:
uv run ruff check .
uv run ruff format --check .
```

---

## 4. API Endpoints

### Health Checks (Public / Monitoring)
* `GET /health/live`: Returns `200 OK` with `{"status": "ok"}` when the process is responsive.
* `GET /health/ready`: Returns `200 OK` with `{"status": "ready", "service": "portfolio-ai-service", "version": "0.1.0", "gemini_configured": true}`.

### Protected API (`/v1/*`)
All endpoints under `/v1` require `X-Internal-Token: <AI_SERVICE_TOKEN>` or `Authorization: Bearer <AI_SERVICE_TOKEN>`.
* `GET /v1/info`: Returns capabilities, environment, and model metadata.

---

## 5. Phase 2 Roadmap: Python Retrieval over RAG Index

Phase 2 will integrate high-performance vector retrieval inside this service:
1. Load and validate `src/data/rag-index.json` into an in-memory NumPy/vector cache.
2. Implement cosine similarity retrieval in Python with query embedding generation via `google-genai`.
3. Provide `/v1/rag/search` and `/v1/rag/chat` endpoints adhering to the `{ reply, sources }` contract.
4. Support hybrid retrieval (keyword + semantic) and query expansion.
