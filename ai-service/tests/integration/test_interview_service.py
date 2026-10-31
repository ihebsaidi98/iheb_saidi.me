"""Integration tests for InterviewSimulatorService with real vector store."""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.interview.schemas import (
    CompleteSessionRequest,
    StartInterviewRequest,
    SubmitAnswerRequest,
)
from app.interview.service import InterviewSimulatorService, clear_active_sessions
from app.rag.store import PortfolioVectorStore


@pytest.fixture(autouse=True)
def clean_sessions():
    """Ensure clean session state for each test."""
    clear_active_sessions()
    yield
    clear_active_sessions()


@pytest.fixture
def real_vector_store() -> PortfolioVectorStore:
    """Load real precomputed portfolio vector store."""
    return PortfolioVectorStore.from_file()


@pytest.mark.asyncio
async def test_interview_service_start_session(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Starting an interview session yields valid session ID, session token, and initial question."""
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
    )

    req = StartInterviewRequest(track="backend")
    res = await service.start_interview(req)

    assert res.session_id.startswith("session-")
    assert len(res.session_token) >= 32
    assert res.track == "backend"
    assert res.total_questions == 10
    assert res.initial_question.question_number == 1
    assert res.initial_question.question_type == "mcq"
    assert res.initial_question.options is not None
    assert len(res.initial_question.options) == 4
    assert res.initial_question.topic != ""


@pytest.mark.asyncio
async def test_interview_service_all_tracks_have_10_questions(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """All 4 tracks must provide 10 questions: 5 MCQ followed by 5 open-ended."""
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
    )

    tracks = ["full_stack", "backend", "frontend", "ai_ml"]
    for trk in tracks:
        req = StartInterviewRequest(track=trk)  # type: ignore[arg-type]
        res = await service.start_interview(req)
        assert res.track == trk
        assert res.total_questions == 10
        assert res.initial_question.question_type == "mcq"


@pytest.mark.asyncio
async def test_interview_service_submit_blind_mcq_and_written_progression(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Candidate submits answers blindly; questions progress from MCQ to open-ended without leaking scores."""
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
    )

    start_res = await service.start_interview(StartInterviewRequest(track="full_stack"))
    sid = start_res.session_id
    token = start_res.session_token
    current_qid = start_res.initial_question.question_id

    # Questions 1-5 are MCQ
    for i in range(1, 6):
        assert start_res.initial_question.question_type == "mcq" if i == 1 else True
        submit_res = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=current_qid,
                answer="201 Created" if i == 1 else "Sample answer",
            )
        )
        assert submit_res.answered_count == i
        assert submit_res.total_questions == 10
        assert submit_res.is_complete is False
        assert submit_res.next_question is not None

        # Verify next question type
        if i < 5:
            assert submit_res.next_question.question_type == "mcq"
        else:
            assert submit_res.next_question.question_type == "open_ended"

        current_qid = submit_res.next_question.question_id

    # Questions 6-10 are open-ended
    for i in range(6, 11):
        submit_res = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=current_qid,
                answer="Detailed architectural explanation covering protocols, caches, and consistency.",
            )
        )
        assert submit_res.answered_count == i
        if i < 10:
            assert submit_res.is_complete is False
            assert submit_res.next_question is not None
            assert submit_res.next_question.question_type == "open_ended"
            current_qid = submit_res.next_question.question_id
        else:
            assert submit_res.is_complete is True
            assert submit_res.next_question is None


@pytest.mark.asyncio
async def test_interview_service_token_mismatch_rejected(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Submitting answer with invalid session_token returns 403 TOKEN_MISMATCH."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track="backend"))

    req = SubmitAnswerRequest(
        session_id=start_res.session_id,
        session_token="wrong-token-abc123",
        question_id=start_res.initial_question.question_id,
        answer="Valid answer",
    )
    with pytest.raises(HTTPException) as exc:
        await service.submit_answer(req)
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "TOKEN_MISMATCH"


@pytest.mark.asyncio
async def test_interview_service_rejects_nonexistent_session(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Submitting answer to an unknown/expired session returns 404 SESSION_NOT_FOUND."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    req = SubmitAnswerRequest(
        session_id="session-nonexistent",
        session_token="some-token",
        question_id="be-mcq-01",
        answer="Valid technical answer exceeding minimum length.",
    )
    with pytest.raises(HTTPException) as exc:
        await service.submit_answer(req)
    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "SESSION_NOT_FOUND"


@pytest.mark.asyncio
async def test_interview_service_rejects_nonexistent_question(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Submitting answer to an invalid question ID returns 404 QUESTION_NOT_FOUND."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track="full_stack"))

    req = SubmitAnswerRequest(
        session_id=start_res.session_id,
        session_token=start_res.session_token,
        question_id="invalid-q-99",
        answer="Valid technical answer exceeding minimum length.",
    )
    with pytest.raises(HTTPException) as exc:
        await service.submit_answer(req)
    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "QUESTION_NOT_FOUND"


@pytest.mark.asyncio
async def test_interview_service_rejects_replayed_answer(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Submitting answer to an already evaluated question returns 409 QUESTION_ALREADY_ANSWERED."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track="full_stack"))
    qid = start_res.initial_question.question_id

    req = SubmitAnswerRequest(
        session_id=start_res.session_id,
        session_token=start_res.session_token,
        question_id=qid,
        answer="201 Created",
    )
    # First submit succeeds
    await service.submit_answer(req)

    # Replay submit fails with 409
    with pytest.raises(HTTPException) as exc:
        await service.submit_answer(req)
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "QUESTION_ALREADY_ANSWERED"


@pytest.mark.asyncio
async def test_interview_service_rejects_out_of_order_answer(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Submitting a question out of order returns 400 OUT_OF_ORDER_ANSWER."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track="full_stack"))

    # Skip Q1 (fs-mcq-01) and try answering Q2 (fs-mcq-02) directly
    req = SubmitAnswerRequest(
        session_id=start_res.session_id,
        session_token=start_res.session_token,
        question_id="fs-mcq-02",
        answer="Valid answer",
    )
    with pytest.raises(HTTPException) as exc:
        await service.submit_answer(req)
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "OUT_OF_ORDER_ANSWER"


@pytest.mark.asyncio
async def test_interview_service_rejects_early_completion(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Calling complete_session before answering all 10 questions raises 422 SESSION_INCOMPLETE."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track="backend"))

    with pytest.raises(HTTPException) as exc:
        await service.complete_session(
            CompleteSessionRequest(
                session_id=start_res.session_id,
                session_token=start_res.session_token,
            )
        )
    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "SESSION_INCOMPLETE"


@pytest.mark.asyncio
async def test_interview_service_complete_session_full_flow(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Full 10-question session evaluation: MCQ scoring, written rubrics, topic breakdown, source links."""
    mock_client = MagicMock()
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    start_res = await service.start_interview(StartInterviewRequest(track="backend"))
    sid = start_res.session_id
    token = start_res.session_token

    # Submit 10 answers
    cur_qid = start_res.initial_question.question_id
    for i in range(1, 11):
        ack = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=cur_qid,
                answer=(
                    "TCP"
                    if i == 1
                    else "PUT"
                    if i == 2
                    else "Token bucket rate limiting with Leaky bucket queuing and distributed tracing context propagation."
                ),
            )
        )
        if ack.next_question:
            cur_qid = ack.next_question.question_id

    # Complete session
    report = await service.complete_session(
        CompleteSessionRequest(session_id=sid, session_token=token)
    )

    assert report.session_id == sid
    assert report.track == "backend"
    assert 0.0 <= report.score_out_of_100 <= 100.0
    assert 0.0 <= report.mcq_score <= 50.0
    assert 0.0 <= report.written_score <= 50.0
    assert len(report.mcq_results) == 5
    assert len(report.written_results) == 5
    assert len(report.topic_breakdown) > 0

    # Verify MCQ result attributes
    first_mcq = report.mcq_results[0]
    assert first_mcq.question_id == "be-mcq-01"
    assert first_mcq.is_correct is True  # "TCP" is correct
    assert first_mcq.source_url.startswith("http")
    assert first_mcq.source_title != ""
    assert first_mcq.explanation != ""

    # Verify Written result attributes
    first_written = report.written_results[0]
    assert first_written.question_id == "be-open-06"
    assert first_written.rubric.overall_score >= 1.0
    assert first_written.source_url.startswith("http")
    assert first_written.source_title != ""

    # Verify idempotency: calling complete_session again returns cached report
    report2 = await service.complete_session(
        CompleteSessionRequest(session_id=sid, session_token=token)
    )
    assert report2.score_out_of_100 == report.score_out_of_100
    assert report2.mcq_score == report.mcq_score


@pytest.mark.asyncio
async def test_interview_service_server_side_rubric_isolation(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Expected talking points and rubrics are never exposed during active session."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    res = await service.start_interview(StartInterviewRequest(track="full_stack"))
    assert res.initial_question.expected_talking_points == []

    cur_qid = res.initial_question.question_id
    for _ in range(1, 10):
        ack = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=res.session_id,
                session_token=res.session_token,
                question_id=cur_qid,
                answer="answer text",
            )
        )
        if ack.next_question:
            assert ack.next_question.expected_talking_points == []
            cur_qid = ack.next_question.question_id


@pytest.mark.asyncio
async def test_interview_service_nonsense_answers_score_zero(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Answers with 0 concept coverage receive baseline rubric 1.0 (0 points awarded)."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track="frontend"))
    sid = start_res.session_id
    token = start_res.session_token

    cur_qid = start_res.initial_question.question_id
    for i in range(1, 11):
        ack = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=cur_qid,
                # Intentionally wrong MCQ answer and completely irrelevant written answer
                answer="WRONG_OPTION" if i <= 5 else "I do not know.",
            )
        )
        if ack.next_question:
            cur_qid = ack.next_question.question_id

    report = await service.complete_session(
        CompleteSessionRequest(session_id=sid, session_token=token)
    )

    assert report.mcq_score == 0.0
    assert report.written_score == 0.0
    assert report.score_out_of_100 == 0.0
    for wr in report.written_results:
        assert wr.rubric.overall_score == 1.0
        assert wr.rubric.accuracy == 1.0
        assert wr.rubric.depth == 1.0


@pytest.mark.asyncio
@pytest.mark.parametrize("track", ["full_stack", "backend", "frontend", "ai_ml"])
async def test_interview_service_all_tracks_complete_successfully(
    track: str, real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Every track completes a full 10-question session and yields a valid report."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track=track))
    sid = start_res.session_id
    token = start_res.session_token

    cur_qid = start_res.initial_question.question_id
    for _ in range(10):
        ack = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=cur_qid,
                answer="Valid answer demonstrating technical understanding.",
            )
        )
        if ack.next_question:
            cur_qid = ack.next_question.question_id

    report = await service.complete_session(
        CompleteSessionRequest(session_id=sid, session_token=token)
    )

    assert report.track == track
    assert len(report.mcq_results) == 5
    assert len(report.written_results) == 5
    assert 0.0 <= report.score_out_of_100 <= 100.0


VERIFIED_MCQ_ANSWERS = {
    "fs-mcq-01": "201 Created",
    "fs-mcq-02": "When its state or props change, or when its parent re-renders",
    "fs-mcq-03": "GET",
    "fs-mcq-04": "Payload",
    "fs-mcq-05": "B-tree",
    "be-mcq-01": "TCP",
    "be-mcq-02": "PUT",
    "be-mcq-03": "Messages may be delivered more than once; consumers must be idempotent",
    "be-mcq-04": "Consistency and Availability",
    "be-mcq-05": "Each INSERT/UPDATE/DELETE must update all indexes, adding write overhead",
    "fe-mcq-01": "padding",
    "fe-mcq-02": "Synchronous code → Promise microtask → setTimeout macrotask",
    "fe-mcq-03": "align-items",
    "fe-mcq-04": "Cross-Site Scripting (XSS) by restricting allowed content sources",
    "fe-mcq-05": "Largest Contentful Paint (LCP)",
    "ai-mcq-01": "Grouping customers by purchase behaviour without predefined categories",
    "ai-mcq-02": "The angle between two vectors, independent of their magnitude",
    "ai-mcq-03": "To prevent attending to padding tokens or future tokens",
    "ai-mcq-04": "Storing and retrieving semantically similar text chunks at inference time",
    "ai-mcq-05": "Dropout",
}

SUBSTANTIVE_WRITTEN_ANSWERS = {
    "fs-open-06": "Browsers enforce the same-origin policy by restricting cross-domain HTTP requests. For non-simple requests with custom headers or methods like PUT/DELETE, the browser automatically dispatches a preflight OPTIONS request to verify permissions. The server responds with Access-Control-Allow-Origin header to permit the origin, and optionally Access-Control-Allow-Credentials if cookies are included.",
    "fs-open-07": "HTTP caching relies on Cache-Control directives: max-age specifies freshness duration, no-cache forces revalidation, no-store prohibits caching, and public/private determines CDN vs browser cache visibility. For mutable resources, conditional requests use ETag with If-None-Match or Last-Modified with If-Modified-Since to return 304 Not Modified. A stale-while-revalidate strategy allows serving cached content while asynchronously revalidating in the background.",
    "fs-open-08": "WebSocket provides full-duplex, bidirectional communication over a single TCP connection after an HTTP upgrade handshake, ideal for real-time multiplayer gaming or chat. Server-Sent Events (SSE) provide unidirectional server-to-client streaming over standard HTTP with automatic reconnection via EventSource API. SSE has better proxy and firewall compatibility over standard HTTP port 80/443, making it ideal for live notifications and stock feeds.",
    "fs-open-09": "ACID guarantees Atomicity (all-or-nothing), Consistency (schema invariants maintained), Isolation (concurrent transactions execute without interference), and Durability (committed changes persist). Isolation violations include dirty reads, non-repeatable reads, and phantom reads. SQL isolation levels range from READ COMMITTED to REPEATABLE READ and SERIALIZABLE. Preventing concurrency bugs requires optimistic locking with version checks or pessimistic locking via SELECT FOR UPDATE.",
    "fs-open-10": "A high-scale URL shortener handles read-heavy workloads (10B redirects/month). The write path generates unique IDs using distributed counters with Base62 encoding to yield compact 7-character keys. The read path caches hot redirects in Redis and terminates redirects at edge CDNs for geographic distribution. Database sharding uses consistent hashing across partitions to prevent hotspotting.",
    "be-open-06": "API rate limiting algorithms include fixed window counter (simple, but susceptible to boundary bursts), sliding window log / sliding window counter (accurate, smooth rate tracking), token bucket (permits configurable bursts while maintaining average throughput), and leaky bucket (smooths output to a steady-state rate). Token bucket is preferred for APIs requiring burst tolerance, while leaky bucket suits queue-based consumers.",
    "be-open-07": "Service discovery enables microservices to locate dynamic network instances. In client-side discovery, the client directly queries a service registry (such as Consul, Eureka, or etcd) and performs load balancing across instances. In server-side discovery, clients query an intermediary load balancer that queries the registry. In Kubernetes, DNS-based discovery resolves service names to virtual cluster IPs, combined with periodic health checks and automatic deregistration.",
    "be-open-08": "The Saga pattern manages distributed transactions across microservices as a sequence of local transactions, executing compensating transactions for rollback on failure. In choreography, services emit events and react to each other asynchronously without central coordination. In orchestration, a central coordinator drives the transaction flow. Sagas require idempotency and at-least-once delivery guarantees to maintain eventual consistency.",
    "be-open-09": "The three pillars of observability are logs (structured events with rich context), metrics (numeric aggregates following the RED method: rate, errors, duration), and traces (tracking end-to-end request journeys across distributed services). Distributed tracing uses trace context propagation headers via W3C TraceContext or B3, with OpenTelemetry serving as the vendor-neutral standard instrumentation SDK.",
    "be-open-10": "Raft is a leader-based consensus algorithm. Leader election uses randomized election timeouts to elect a single leader per term, preventing split-brain. In log replication, the leader appends entries and followers acknowledge until a majority quorum commits. Linearizable reads require checking leader leases or round-trip heartbeats with followers to confirm leadership before returning data, accompanied by log compaction via snapshots.",
    "fe-open-06": "In React, useEffect runs asynchronously after paint, rather than during render. An empty dependency array runs the effect once on mount and cleanup on unmount; omitting the dependency array runs the effect after every render. A stale closure occurs when a callback captures values at effect creation time without including them in dependencies. Cleanup functions cancel subscriptions or timers to prevent memory leaks.",
    "fe-open-07": "Accessible modal dialogs require ARIA attributes: role='dialog', aria-modal='true', and aria-labelledby referencing the title element. Key accessibility requirements include keyboard focus management (trapping focus inside the modal and restoring focus on close), closing on Escape key press, and aria-live regions for dynamic content announcements while prioritising semantic HTML.",
    "fe-open-08": "Client-side state management trade-offs: local component state is co-located with isolated UI and avoids prop drilling. Context API avoids prop drilling for subtrees but re-renders all consumers on state changes. Redux provides predictable state transitions and DevTools for complex shared state. Zustand and Jotai provide lightweight, selector-based state that eliminates Redux boilerplate. Dedicated libraries like React Query or SWR manage server state versus client state.",
    "fe-open-09": "Frontend performance optimisation uses code splitting to separate bundles per route or component using React.lazy and Suspense boundaries for dynamic imports. Tree shaking performs dead code elimination via ESM static analysis. Bundles can be further optimised by preloading critical chunks and using a bundle analyser to identify oversized dependencies.",
    "fe-open-10": "The browser rendering pipeline parses HTML to build the DOM, parses CSS to build the CSSOM, and combines them into the Render Tree. Next, Layout (reflow) computes element positions and sizes, Paint fills pixels on layers, and Composite combines layers on the GPU. To minimise cost and avoid layout thrashing, developers batch DOM writes and animate composite-only properties like transform and opacity.",
    "ai-open-06": "Prompt injection occurs when malicious user input overrides system instructions to alter model behaviour. Indirect prompt injection happens via retrieved documents containing adversarial payloads in RAG pipelines. Defences include XML delimiter isolation for untrusted content, strict input validation and allowlist filtering, and robust output validation and parsing to prevent command execution.",
    "ai-open-07": "Fine-tuning updates foundation model weights on domain-specific examples, baking knowledge permanently into weights; it is expensive, static, and best suited for tone, format, or specialized reasoning. Retrieval-Augmented Generation (RAG) retrieves fresh, up-to-date data at inference time from external document stores. A hybrid approach often combines a fine-tuned model with RAG retrieval for optimal grounding.",
    "ai-open-08": "Mitigating hallucinations in production RAG systems requires multi-layered controls: similarity threshold gating before the LLM call to discard irrelevant chunks, context-grounded prompting instructing the model to cite only retrieved text, self-consistency and chain-of-thought verification across sampled outputs, post-generation fact-checking against retrieved sources, and explicit abstention when evidence is insufficient.",
    "ai-open-09": "Evaluating RAG systems requires measuring retrieval and generation quality: Context Precision measures the fraction of retrieved chunks that are relevant, Context Recall measures the fraction of relevant chunks actually retrieved, Faithfulness verifies that the answer is grounded in retrieved context without hallucination, and Answer Relevance measures how well the response addresses the prompt. End-to-end evaluation uses ROUGE, BLEU, or human evaluation benchmarks.",
    "ai-open-10": "Serving high-throughput LLM APIs (10,000 rpm) with low p99 latency requires continuous batching / dynamic batching to maximize GPU utilization, tensor parallelism across multiple GPUs for large model weights, quantization (INT8, GPTQ, AWQ) to reduce memory bandwidth and latency, efficient KV cache management with PagedAttention, and horizontal autoscaling of inference replicas based on queue depth.",
}


@pytest.mark.asyncio
@pytest.mark.parametrize("track", ["full_stack", "backend", "frontend", "ai_ml"])
async def test_interview_service_perfect_candidate_scores_high_across_all_tracks(
    track: str, real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """A candidate providing verified correct MCQs and substantive written answers scores >= 95."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track=track))
    sid = start_res.session_id
    token = start_res.session_token

    cur_q = start_res.initial_question
    for i in range(1, 11):
        qid = cur_q.question_id
        ans = VERIFIED_MCQ_ANSWERS[qid] if i <= 5 else SUBSTANTIVE_WRITTEN_ANSWERS[qid]

        ack = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=qid,
                answer=ans,
            )
        )
        if ack.next_question:
            cur_q = ack.next_question

    report = await service.complete_session(
        CompleteSessionRequest(session_id=sid, session_token=token)
    )

    assert report.track == track
    assert report.mcq_score == 50.0  # All 5 MCQs correct (5 * 10 = 50)
    for mcq in report.mcq_results:
        assert mcq.is_correct is True

    assert report.written_score >= 45.0  # Substantive written answers score >= 45/50
    for wr in report.written_results:
        assert wr.rubric.overall_score >= 4.0

    assert report.score_out_of_100 >= 95.0
    assert any(
        "Perfect score on all multiple-choice questions" in s
        for s in report.overall_strengths
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("track", ["full_stack", "backend", "frontend", "ai_ml"])
async def test_interview_service_incorrect_candidate_control_scores_zero(
    track: str, real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """An incorrect candidate submitting wrong MCQs and off-topic written answers scores 0.0."""
    service = InterviewSimulatorService(store=real_vector_store, settings=test_settings)
    start_res = await service.start_interview(StartInterviewRequest(track=track))
    sid = start_res.session_id
    token = start_res.session_token

    cur_q = start_res.initial_question
    for i in range(1, 11):
        qid = cur_q.question_id
        ans = "WRONG_ANSWER" if i <= 5 else "I do not know the answer to this question."

        ack = await service.submit_answer(
            SubmitAnswerRequest(
                session_id=sid,
                session_token=token,
                question_id=qid,
                answer=ans,
            )
        )
        if ack.next_question:
            cur_q = ack.next_question

    report = await service.complete_session(
        CompleteSessionRequest(session_id=sid, session_token=token)
    )

    assert report.track == track
    assert report.mcq_score == 0.0
    assert report.written_score == 0.0
    assert report.score_out_of_100 == 0.0
    for mcq in report.mcq_results:
        assert mcq.is_correct is False
    for wr in report.written_results:
        assert wr.rubric.overall_score == 1.0
