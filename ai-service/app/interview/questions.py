"""Curated technical questions grounded in Iheb's portfolio projects and architecture."""

from app.interview.schemas import InterviewDifficulty, InterviewTrack

QUESTION_BANK: list[dict] = [
    # Full-Stack Track
    {
        "question_id": "fs-01",
        "question_text": "In your AgroRetail OS SaaS project, how did you architect the boundary between the Next.js frontend and the multi-tenant backend services?",
        "track": "full_stack",
        "difficulty": "senior",
        "context_source": {
            "id": "project-agroretail-os",
            "title": "AgroRetail OS — Multi-tenant SaaS",
            "type": "project",
        },
        "expected_talking_points": [
            "tenant isolation",
            "Next.js App Router API routes",
            "JWT / bearer token propagation",
            "SSR vs client-side state hydration",
            "multi-tenancy partitioning in PostgreSQL",
        ],
        "ideal_answer": "In AgroRetail OS, tenant isolation is maintained via tenant-aware headers and JWT claims passed from Next.js server components or route handlers to Spring Boot backend APIs. The database layer uses schema or column-based multi-tenancy in PostgreSQL with connection pooling, ensuring strict data boundaries.",
    },
    {
        "question_id": "fs-02",
        "question_text": "How do you manage client-side state, form validations, and asynchronous optimistic UI updates when using React and TypeScript?",
        "track": "full_stack",
        "difficulty": "standard",
        "context_source": {
            "id": "skills-frontend",
            "title": "Technical Skills — Frontend",
            "type": "skills",
        },
        "expected_talking_points": [
            "React state hooks",
            "TypeScript type safety",
            "Zod schema validation",
            "optimistic UI updates with rollback",
            "caching and synchronization",
        ],
        "ideal_answer": "We pair React state hooks with Zod schemas for runtime and static TypeScript validation. For responsive user experience, optimistic UI mutations render immediate state feedback and rollback gracefully if the backend responds with a network or validation error.",
    },
    {
        "question_id": "fs-03",
        "question_text": "As a lead full-stack engineer, how do you enforce end-to-end type safety and contract consistency across decoupled frontend and microservice repositories?",
        "track": "full_stack",
        "difficulty": "lead",
        "context_source": {
            "id": "profile-overview",
            "title": "Professional Profile",
            "type": "profile",
        },
        "expected_talking_points": [
            "OpenAPI / Swagger specifications",
            "automated TypeScript client generation",
            "contract testing with Pact or schema validators",
            "CI/CD pipeline validation",
            "versioning and backward compatibility",
        ],
        "ideal_answer": "We maintain OpenAPI specifications as the single source of truth, automating TypeScript client and type generation in CI/CD. Breaking schema changes are caught automatically via schema diffing before merging, ensuring zero contract drift between frontend and backend.",
    },
    # Backend Architecture Track
    {
        "question_id": "be-01",
        "question_text": "At Novatek, you built a real-time industrial supervision platform. How did you design the backend to handle high-frequency telemetry events and prevent database bottlenecks?",
        "track": "backend_architecture",
        "difficulty": "senior",
        "context_source": {
            "id": "experience-novatek-d-lice-group",
            "title": "Full Stack Engineer at Novatek",
            "type": "experience",
        },
        "expected_talking_points": [
            "Spring Boot reactive or asynchronous processing",
            "message queuing with Kafka or RabbitMQ",
            "batch database insertions",
            "Redis caching for active telemetry states",
            "connection pool tuning (HikariCP)",
        ],
        "ideal_answer": "At Novatek, high-frequency telemetry was ingested via asynchronous Spring Boot event consumers decoupled through message brokers. We utilized Redis for real-time state caching and batch-persisted historical events to PostgreSQL, eliminating database write bottlenecks and sustaining 30% lower system downtime.",
    },
    {
        "question_id": "be-02",
        "question_text": "Explain how you implement distributed transaction management or eventual consistency across independent Spring Boot microservices.",
        "track": "backend_architecture",
        "difficulty": "lead",
        "context_source": {
            "id": "skills-backend",
            "title": "Technical Skills — Backend",
            "type": "skills",
        },
        "expected_talking_points": [
            "Saga pattern (orchestration vs choreography)",
            "compensating transactions",
            "idempotency keys",
            "outbox pattern for event publishing",
            "dead letter queues",
        ],
        "ideal_answer": "Rather than brittle two-phase commits, we apply the Saga pattern using an outbox pattern for guaranteed message publishing. Services verify idempotency using unique transaction IDs and invoke compensating transactions if a downstream step fails, ensuring eventual consistency.",
    },
    {
        "question_id": "be-03",
        "question_text": "How do you configure and secure REST API endpoints in Spring Boot with Spring Security and JWT?",
        "track": "backend_architecture",
        "difficulty": "standard",
        "context_source": {
            "id": "skills-backend",
            "title": "Technical Skills — Backend",
            "type": "skills",
        },
        "expected_talking_points": [
            "Spring Security filter chain",
            "stateless session management",
            "JWT token validation filter",
            "role-based access control (@PreAuthorize)",
            "CORS configuration",
        ],
        "ideal_answer": "We configure SecurityFilterChain with stateless session policy, add a OncePerRequestFilter to parse and validate JWT signatures, and enforce role-based permissions using method security annotations like @PreAuthorize.",
    },
    # AI & Agentic RAG Track
    {
        "question_id": "ai-01",
        "question_text": "In your Agentic RAG implementation, how do you prevent hallucinations and ensure safe abstention when user questions are outside portfolio knowledge?",
        "track": "ai_rag",
        "difficulty": "senior",
        "context_source": {
            "id": "skills-ai-llm",
            "title": "Technical Skills — AI & LLM",
            "type": "skills",
        },
        "expected_talking_points": [
            "intent classification / routing",
            "similarity score thresholding (e.g. 0.35)",
            "evidence sufficiency checks",
            "XML context isolation tags",
            "canned abstention without LLM call",
        ],
        "ideal_answer": "We employ a defense-in-depth pipeline: queries are first routed through an intent classifier to immediately reject out-of-scope topics. Retrieved vector chunks are filtered by cosine similarity threshold (0.35). If the best score falls below threshold, the system abstains with a canned message before any LLM call, preventing hallucination.",
    },
    {
        "question_id": "ai-02",
        "question_text": "How do vector embeddings work with cosine similarity, and why is L2 normalization important for retrieval performance in NumPy?",
        "track": "ai_rag",
        "difficulty": "standard",
        "context_source": {
            "id": "skills-ai-llm",
            "title": "Technical Skills — AI & LLM",
            "type": "skills",
        },
        "expected_talking_points": [
            "high-dimensional vector space (768 dims)",
            "dot product of unit vectors equals cosine similarity",
            "precomputing L2 norm eliminates runtime norm division",
            "vectorized matrix multiplication with np.dot or @",
            "sub-millisecond latency",
        ],
        "ideal_answer": "Cosine similarity measures the angle between query and document vectors. By pre-normalizing vectors to unit length using L2 norm during startup, cosine similarity reduces to a pure matrix dot product (matrix @ query), running in sub-millisecond vectorized C-speed without runtime square roots or divisions.",
    },
    {
        "question_id": "ai-03",
        "question_text": "How would you architect a production Agentic RAG pipeline to handle multi-part queries and avoid context window pollution?",
        "track": "ai_rag",
        "difficulty": "lead",
        "context_source": {
            "id": "skills-ai-llm",
            "title": "Technical Skills — AI & LLM",
            "type": "skills",
        },
        "expected_talking_points": [
            "query decomposition into bounded subqueries (<= 3)",
            "iterative retrieval and chunk deduplication by ID",
            "preserving highest similarity score on duplicate chunks",
            "deterministic tie-breaking",
            "context budgeting / max chunk caps (<= 10)",
        ],
        "ideal_answer": "The system decomposes complex queries into at most 3 focused subqueries, executes parallel or bounded iterative retrieval, deduplicates chunks by unique ID keeping the highest relevance score, and caps context chunks to 10. This ensures maximum evidence density without overflowing context windows.",
    },
]


def get_questions_by_track_and_difficulty(
    track: InterviewTrack,
    difficulty: InterviewDifficulty = "senior",
) -> list[dict]:
    """Retrieve filtered list of questions matching track and difficulty."""
    matches = [
        q
        for q in QUESTION_BANK
        if q["track"] == track and q["difficulty"] == difficulty
    ]
    if not matches:
        # Fallback to any difficulty within track
        matches = [q for q in QUESTION_BANK if q["track"] == track]
    return matches or QUESTION_BANK


def get_question_by_id(question_id: str) -> dict | None:
    """Find specific question in bank by its unique question_id."""
    for q in QUESTION_BANK:
        if q["question_id"] == question_id:
            return q
    return None
