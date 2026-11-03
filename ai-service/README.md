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
- **Fail-Fast Configuration**: Settings are validated at application startup using Pydantic Settings. No credential has a fallback value: a missing `AI_SERVICE_TOKEN` prevents startup in `staging` and `production` (see §2).
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
| `AI_SERVICE_TOKEN` | Secret | *(none — must be set explicitly)* | Shared secret for server-to-server Next.js authentication. There is no default value; it must be at least 32 characters in `staging`/`production` (see below). |
| `ENVIRONMENT` | String | `development` | Environment mode (`development`, `test`, `production`) |
| `HOST` | String | `127.0.0.1` | Bind host |
| `PORT` | Integer | `8001` | Bind port used by `python -m app.main` (`app/main.py` passes `settings.port` to uvicorn). `npm run ai:dev` pins `--port 8001`, while the Docker image pins `--port 8000` (`ai-service/Dockerfile`) — that is why `docker-compose.yml` maps host `8001` to container `8000`. |
| `ALLOWED_ORIGINS` | String/List | `http://localhost:3000,http://127.0.0.1:3000` | Allowed CORS origins |
| `REQUEST_TIMEOUT_SECONDS` | Float | `15.0` | Default timeout for external requests |
| `MAX_REQUEST_SIZE_BYTES` | Integer | `1048576` | Maximum request body size (1MB) |

### `AI_SERVICE_TOKEN`: no default value

The service ships **no fallback or development token**. `AI_SERVICE_TOKEN` must be set explicitly, and the value must be **exactly the same** in the Next.js environment (`.env.local`) and in this service (`ai-service/.env`).

From the repository root:

```bash
python scripts/setup-env.py
```

The script:
- generates a cryptographically strong secret (`secrets.token_urlsafe(32)`, 43 characters),
- writes that single value into both `.env.local` and `ai-service/.env`,
- reads both files back and aborts if the two values differ,
- refuses to run when either file already exists (delete them manually to regenerate).

To provision the secret by hand instead, generate one value and paste the **same** string in both files:

```bash
openssl rand -hex 32
```

Behaviour when the token is missing, empty, or too short:

| Context | Behaviour |
|---|---|
| `development` | The service starts but logs a WARNING (the value itself is never logged) and rejects every `/v1/*` request with `401 UNAUTHORIZED` — fail closed. On the Next.js side internal delegation stays disabled: no `X-Internal-Token` header is sent and the interview endpoints answer `503 SERVICE_UNAVAILABLE`. |
| `staging`, `production` | Startup aborts with `RuntimeError: A strong AI_SERVICE_TOKEN must be configured in <environment>.` when the token is empty, shorter than 32 characters, or still set to the former development placeholder. |

The token is only ever compared server-side with `secrets.compare_digest`. It is never returned in HTTP responses, written to logs, or included in client bundles.

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

### Configuring the Internal Token
Before starting the service, configure the shared secret as described in §2 (`python scripts/setup-env.py`). Without it, `/v1/*` calls are rejected with `401`.

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
* `POST /v1/rag/search`: Cosine similarity vector search over the precomputed portfolio index.
  * Body: `{"query": string, "limit": int = 5, "threshold": float = 0.35}`
  * Returns: `{"query": string, "results": SearchResultItem[], "total": int, "index_version": string}`
* `POST /v1/rag/chat`: Grounded chat generation adhering to the Next.js portfolio contract.
  * Body: `{"message": string, "limit": int = 5, "threshold": float = 0.35, "history": ChatMessage[] = []}`
  * Returns: `{"reply": string, "sources": [{"id": string, "title": string, "type": string}]}`
  * Security: Context is isolated inside `<retrieved_context>` XML tags. If no chunks exceed threshold, returns safe canned refusal (`"I don't have that information in my portfolio data."`) without invoking the LLM.
* `POST /v1/agent/answer`: Agentic RAG orchestration endpoint (enabled when `AGENTIC_RAG_ENABLED=true`).
  * Body: `{"message": string, "max_subqueries": int = 3, "retrieval_limit": int = 5, "threshold": float = 0.35}`
  * Returns:
    ```json
    {
      "reply": "string",
      "sources": [{"id": "string", "title": "string", "type": "string"}],
      "metadata": {
        "intent": "portfolio_factual" | "multi_part" | "career_advice" | "out_of_scope",
        "subqueries": ["string"],
        "subqueries_count": 1,
        "retrieval_count": 1,
        "abstained": false,
        "execution_time_ms": 12.5
      }
    }
    ```
  * Features:
    * Deterministic Intent Routing: Categorizes into `portfolio_factual`, `multi_part`, `career_advice`, or `out_of_scope`.
    * Fast Refusal: Safely abstains on `out_of_scope` queries immediately without consuming embedding or LLM quota.
    * Bounded Query Decomposition: Decomposes complex or comparative questions into $\le 3$ focused subqueries with deterministic fallback.
    * Multi-hop Retrieval & Deduplication: Queries vector store iteratively ($\le 6$ calls, capped at 10 chunks), deduplicates by chunk ID keeping highest score, and resolves ties deterministically.
    * Evidence Sufficiency Check: Validates retrieved evidence meets relevance threshold before invoking generation.

* `POST /v1/copilot/match-job`: Automated candidate skill alignment and gap analysis against job descriptions.
  * Body: `{"job_description": string, "target_role": string | null}`
  * Returns: `{"match_score": float, "matched_skills": SkillMatchItem[], "gap_skills": string[], "strengths": string[], "summary": string, "cited_sources": ChatSource[]}`
* `POST /v1/copilot/project-deep-dive`: Deep technical and architectural extraction for a portfolio project.
  * Body: `{"project_keyword": string}`
  * Returns: `{"project_title": string, "role": string, "company": string | null, "period": string | null, "technologies": string[], "architecture_highlights": string[], "impact_metrics": string[], "summary": string, "sources": ChatSource[]}`
* `POST /v1/interview/start`: Start an adaptive technical interview session.
  * Body: `{"track": "full_stack" | "backend_architecture" | "ai_rag", "difficulty": "standard" | "senior" | "lead", "focus_areas": string[]}`
  * Returns: `{"session_id": string, "track": string, "difficulty": string, "initial_question": InterviewQuestion}`
* `POST /v1/interview/submit-answer`: Evaluate technical response against multi-criteria rubric with adaptive follow-up question.
  * Body: `{"session_id": string, "question_id": string, "answer": string}`
  * Returns: `{"session_id": string, "question_id": string, "rubric": RubricScore, "strengths": string[], "areas_for_improvement": string[], "sample_ideal_answer": string, "next_question": InterviewQuestion | null}`

---

## 5. RAG Evaluation Benchmark

A standalone deterministic evaluation suite assesses retrieval quality without requiring external API quota by default:

```bash
# Run deterministic offline evaluation (Recall@1, Recall@3, Recall@5, MRR)
npm run ai:eval
# or:
uv run python scripts/evaluate_retrieval.py

# Optional: Run live evaluation against Google Gemini embeddings (requires GEMINI_API_KEY)
uv run python scripts/evaluate_retrieval.py --mode live

# Output machine-readable JSON metrics
uv run python scripts/evaluate_retrieval.py --json
```

### Retrieval Quality Gates
- **Recall@5**: Target >= 85% (Achieved: **100%**)
- **Mean Reciprocal Rank (MRR)**: Target >= 0.70 (Achieved: **1.0000**)
- **Latency**: Sub-millisecond vectorized dot-product search (< 0.20 ms)

---

## 6. Phase 3 Roadmap & Milestones

1. [x] **Stage 0**: Baseline audit across Python & Next.js suites (all green).
2. [x] **Stage 1**: Agentic RAG orchestration (`/v1/agent/answer`), intent routing, query decomposition, and bounded retrieval.
3. [x] **Stage 2**: Career Copilot specialized tooling and profile synthesis (`/v1/copilot/match-job`, `/v1/copilot/project-deep-dive`).
4. [x] **Stage 3**: Adaptive interview simulation and evaluation (`/v1/interview/start`, `/v1/interview/submit-answer`).

