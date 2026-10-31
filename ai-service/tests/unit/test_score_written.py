"""Unit tests for _score_written() scoring quality.

These tests verify evidence-based fixes for four defects found during the
written-answer scoring audit:

  Defect 1 (MEDIUM-HIGH) — False negative: semantic paraphrasing scored zero.
    Correct answers using accepted abbreviations (SOP, ACAO, SSE, OTEL) or
    different but valid phrasing received coverage=0 and a fabricated floor.

  Defect 2 (MEDIUM) — False positive: clarity inflated by answer length.
    clarity = 4.5 whenever len(answer) >= 100, regardless of content.
    A 100-char filler with 1/5 points covered scored clarity=4.5.

  Defect 3 (LOW-MEDIUM) — False positive: prefix match threshold too low (>=4).
    Short topic prefixes (e.g. "logs") caused a full talking-point match for any
    answer that mentioned the word.

  Defect 4 (LOW) — False negative: hyphens/slashes in talking-point tokens.
    "steady-state" was one word after split(); an answer saying "steady state"
    (without hyphen) did not match.

All tests call _score_written() directly on synthetic question dicts so no
session infrastructure is needed.
"""

import asyncio
from typing import Any

from app.interview.service import InterviewSimulatorService, _expand_synonyms

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service() -> InterviewSimulatorService:
    """Minimal service with no vector store or Gemini client."""

    class _FakeStore:
        pass

    class _FakeSettings:
        gemini_chat_model = "gemini-1.5-flash"
        request_timeout_seconds = 10

    return InterviewSimulatorService(
        store=_FakeStore(),  # type: ignore[arg-type]
        settings=_FakeSettings(),  # type: ignore[arg-type]
        gemini_client=None,  # LLM disabled — deterministic scoring only
    )


def _q(talking_points: list[str], ideal: str = "ideal") -> dict[str, Any]:
    """Build a minimal open_ended question dict for scoring tests."""
    return {
        "question_id": "test-q",
        "question_type": "open_ended",
        "track": "test",
        "difficulty": 6,
        "topic": "Test Topic",
        "question_text": "Explain the concept.",
        "options": None,
        "correct_answer_index": None,
        "source_url": "https://example.com",
        "source_title": "Example",
        "expected_talking_points": talking_points,
        "ideal_answer": ideal,
    }


def _score(talking_points: list[str], answer: str) -> Any:
    """Synchronously score *answer* against *talking_points*. Returns WrittenResult."""
    svc = _make_service()
    q = _q(talking_points, ideal="ideal answer")
    return asyncio.run(svc._score_written(q, answer, question_number=6))


# ---------------------------------------------------------------------------
# Empty / short answers — floor guard (regression, must stay working)
# ---------------------------------------------------------------------------


def test_empty_answer_scores_floor() -> None:
    """Empty answer -> all rubric dims = 1.0, overall = 1.0."""
    result = _score(["same-origin policy", "preflight OPTIONS request"], "")
    assert result.rubric.overall_score == 1.0
    assert result.rubric.accuracy == 1.0
    assert result.rubric.clarity == 1.0
    assert result.rubric.depth == 1.0
    assert result.rubric.problem_solving == 1.0


def test_short_answer_under_20_chars_scores_floor() -> None:
    """Answer under 20 chars -> floor 1.0 regardless of keyword presence."""
    result = _score(["same-origin policy"], "same-origin policy")
    # "same-origin policy" is 18 chars -- floor must apply
    assert result.rubric.overall_score == 1.0


def test_irrelevant_long_answer_scores_floor() -> None:
    """A long but irrelevant answer with zero concept coverage -> floor 1.0."""
    noise = "blah " * 30  # 150 chars, no relevant keywords
    result = _score(
        [
            "same-origin policy",
            "Access-Control-Allow-Origin header",
            "preflight OPTIONS request",
        ],
        noise,
    )
    assert result.rubric.overall_score == 1.0
    assert result.rubric.clarity == 1.0  # length must NOT inflate clarity here


# ---------------------------------------------------------------------------
# Defect 2 -- FALSE POSITIVE: clarity must not be inflated by length alone
# ---------------------------------------------------------------------------


def test_clarity_not_inflated_by_long_filler() -> None:
    """100-char filler with only 1/5 concept coverage should not reach clarity >= 3.5."""
    # 1/5 points -> coverage = 0.2
    filler = "token bucket " * 8  # mentions token bucket only, ~104 chars
    result = _score(
        [
            "Fixed window counter",
            "Sliding window log / sliding window counter",
            "Token bucket",
            "Leaky bucket",
            "burst vs steady-state behaviour",
        ],
        filler,
    )
    # coverage = 0.2; clarity = 1 + 3.5*0.2 + 0.3 = 2.0 (not 4.5)
    assert result.rubric.clarity < 3.5, (
        f"clarity={result.rubric.clarity} is too high for 1/5 coverage"
    )


def test_clarity_not_penalised_for_concise_correct_answer() -> None:
    """A precise answer covering 3/5 points should have clarity > 2.0."""
    answer = (
        "Use a token bucket for burst tolerance and a leaky bucket for steady output. "
        "Fixed window is simplest but allows boundary bursts."
    )
    result = _score(
        [
            "Fixed window counter",
            "Sliding window log / sliding window counter",
            "Token bucket",
            "Leaky bucket",
            "burst vs steady-state behaviour",
        ],
        answer,
    )
    # coverage >= 0.4; clarity = 1 + 3.5*0.4 >= 2.4
    assert result.rubric.clarity >= 2.0


# ---------------------------------------------------------------------------
# Defect 1 -- FALSE NEGATIVE: abbreviations / synonyms
# ---------------------------------------------------------------------------


def test_sop_abbreviation_matches_same_origin_policy() -> None:
    """Answer using 'SOP' should match the 'same-origin policy' talking point."""
    answer = (
        "Browsers enforce the SOP which blocks cross-domain requests by default. "
        "An OPTIONS preflight is sent for non-simple requests before the real call."
    )
    result = _score(
        [
            "same-origin policy",
            "preflight OPTIONS request",
            "Access-Control-Allow-Origin header",
        ],
        answer,
    )
    # At minimum 'same-origin policy' (via SOP) and 'preflight OPTIONS request' should match
    assert result.rubric.overall_score > 1.0, (
        "Expected coverage > 0 for answer using 'SOP' and 'OPTIONS preflight'"
    )
    # Confirm SOP expansion works at the helper level
    expanded = _expand_synonyms("sop is enforced")
    assert "same-origin policy" in expanded


def test_acao_abbreviation_matches_access_control_header() -> None:
    """Answer using 'ACAO' should contribute to matching the CORS header talking point."""
    answer = (
        "The server must include the ACAO header to permit the requesting origin. "
        "Browsers enforce the same-origin policy and block responses without it."
    )
    result = _score(
        [
            "same-origin policy",
            "Access-Control-Allow-Origin header",
        ],
        answer,
    )
    assert result.rubric.overall_score > 1.0, (
        "Expected both talking points matched via 'ACAO' and 'same-origin policy'"
    )


def test_sse_abbreviation_matches_server_sent_events() -> None:
    """Answer using 'SSE' should match the unidirectional server-to-client talking point."""
    answer = (
        "WebSocket provides full duplex bidirectional communication. "
        "SSE is unidirectional, sending data from server to client only, "
        "with automatic reconnect via EventSource."
    )
    result = _score(
        [
            "WebSocket: bidirectional, full-duplex, single TCP connection",
            "SSE: unidirectional server-to-client, over HTTP",
            "SSE: automatic reconnection, EventSource API",
        ],
        answer,
    )
    assert result.rubric.overall_score > 1.0, (
        "Expected coverage > 0 for answer mentioning 'WebSocket' and 'SSE'"
    )


def test_otel_abbreviation_matches_opentelemetry() -> None:
    """Answer using 'OTel' should match the 'OpenTelemetry' talking point."""
    answer = (
        "We instrument services with OTel and export traces to Jaeger. "
        "Trace context is propagated via W3C Trace Context headers across service calls."
    )
    result = _score(
        [
            "traces: end-to-end request journey across services",
            "trace context propagation (W3C TraceContext / B3)",
            "OpenTelemetry as standard instrumentation SDK",
        ],
        answer,
    )
    assert result.rubric.overall_score > 1.0, (
        "Expected OTel->OpenTelemetry and W3C trace context expansion to yield coverage > 0"
    )


# ---------------------------------------------------------------------------
# Defect 4 -- FALSE NEGATIVE: hyphenated / slashed talking-point terms
# ---------------------------------------------------------------------------


def test_hyphenated_term_matched_by_space_form() -> None:
    """'steady state' (no hyphen) in the answer should match 'steady-state behaviour'."""
    answer = (
        "Token bucket allows short bursts while leaky bucket enforces a smooth "
        "steady state output rate. Fixed window can allow double the rate at boundaries."
    )
    result = _score(
        [
            "Fixed window counter",
            "Token bucket",
            "Leaky bucket",
            "burst vs steady-state behaviour",
        ],
        answer,
    )
    # steady state, token bucket, leaky bucket, fixed window -> 4/4
    assert result.rubric.overall_score > 3.0, (
        f"Expected high score for answer covering 4/4 points; got {result.rubric.overall_score}"
    )


def test_w3c_trace_context_slash_form_matched() -> None:
    """'W3C Trace Context' (spaced) should match the slashed talking-point form."""
    answer = (
        "We propagate W3C Trace Context headers across service boundaries. "
        "OpenTelemetry provides the SDK and Jaeger collects the traces."
    )
    result = _score(
        [
            "trace context propagation (W3C TraceContext / B3)",
            "OpenTelemetry as standard instrumentation SDK",
        ],
        answer,
    )
    assert result.rubric.overall_score > 1.0, (
        "Expected 'W3C Trace Context' to match the slash-form talking point"
    )


# ---------------------------------------------------------------------------
# Defect 3 -- FALSE POSITIVE: prefix match must not be too broad
# ---------------------------------------------------------------------------


def test_prefix_match_not_triggered_by_short_topic_word() -> None:
    """An answer saying only 'logs are important' should NOT match
    the full talking point 'logs: structured events with context'."""
    answer = "logs are important and metrics are useful for monitoring systems"
    result = _score(
        [
            "logs: structured events with context",
            "metrics: numeric aggregates (RED: rate, errors, duration)",
            "traces: end-to-end request journey across services",
        ],
        answer,
    )
    # 'logs' is 4 chars, 'metrics' is 7 chars -- both below the new >=8 threshold.
    # Neither should trigger prefix match alone.
    assert result.rubric.overall_score == 1.0, (
        f"Short prefix 'logs'/'metrics' should not match full talking points; "
        f"got overall={result.rubric.overall_score}"
    )


def test_long_prefix_still_matches_correctly() -> None:
    """The prefix 'cache-control' (13 chars) should still match the Cache-Control point."""
    answer = (
        "Use Cache-Control with max-age for static assets and no-cache for API "
        "responses. ETags enable conditional requests returning 304 Not Modified."
    )
    result = _score(
        [
            "Cache-Control: max-age, no-cache, no-store, public, private",
            "ETag and conditional requests (If-None-Match)",
        ],
        answer,
    )
    assert result.rubric.overall_score > 1.0, (
        "Expected Cache-Control and ETag prefix/keyword matches to yield coverage > 0"
    )


# ---------------------------------------------------------------------------
# Partial coverage -- proportional rubric scores
# ---------------------------------------------------------------------------


def test_partial_coverage_produces_intermediate_scores() -> None:
    """An answer covering ~4/5 talking points should produce an intermediate overall score."""
    answer = (
        "A Saga breaks distributed transactions into a sequence of local transactions. "
        "On failure, compensating transactions undo previous steps. "
        "In choreography, services emit events and react to each other. "
        "In orchestration, a central coordinator drives the flow."
    )
    result = _score(
        [
            "Saga: sequence of local transactions with compensating transactions",
            "choreography: services emit events and react to each other",
            "orchestration: central coordinator drives the flow",
            "compensating transactions for rollback",
            "idempotency and at-least-once delivery",
        ],
        answer,
    )
    assert 1.5 < result.rubric.overall_score < 5.0, (
        f"Expected intermediate score for ~4/5 coverage; got {result.rubric.overall_score}"
    )


def test_full_coverage_produces_high_scores() -> None:
    """An answer covering all 5 talking points should score overall >= 4.0."""
    answer = (
        "ACID properties: Atomicity (all-or-nothing), Consistency (rules valid), "
        "Isolation (concurrent transactions do not interfere), Durability (crash-safe). "
        "A dirty read occurs when a transaction reads uncommitted data. "
        "Non-repeatable reads happen when values change between two reads in the same tx. "
        "Phantom reads occur with new rows appearing. "
        "Isolation levels: READ COMMITTED, REPEATABLE READ, SERIALIZABLE. "
        "Use SELECT FOR UPDATE for pessimistic locking, or optimistic locking with version column."
    )
    result = _score(
        [
            "Atomicity, Consistency, Isolation, Durability",
            "dirty read, non-repeatable read, phantom read",
            "isolation levels: READ COMMITTED, REPEATABLE READ, SERIALIZABLE",
            "optimistic vs pessimistic locking",
            "SELECT FOR UPDATE",
        ],
        answer,
    )
    assert result.rubric.overall_score >= 4.0, (
        f"Expected high score for full-coverage answer; got {result.rubric.overall_score}"
    )


# ---------------------------------------------------------------------------
# Correctness: incorrect / hallucinated answers
# ---------------------------------------------------------------------------


def test_incorrect_answer_does_not_score_high() -> None:
    """An answer about unrelated tech (Docker/K8s) should score floor on CORS question."""
    answer = (
        "Docker containers use namespaces and cgroups for isolation. "
        "Kubernetes schedules pods across nodes using the scheduler."
    )
    result = _score(
        [
            "same-origin policy",
            "Access-Control-Allow-Origin header",
            "preflight OPTIONS request",
            "simple vs non-simple requests",
            "credentials and Access-Control-Allow-Credentials",
        ],
        answer,
    )
    assert result.rubric.overall_score == 1.0, (
        "Docker/Kubernetes answer should not score above floor on CORS question"
    )


def test_answer_with_scattered_keywords_does_not_reach_max() -> None:
    """Repeating isolated keywords without structure should not reach 5.0."""
    answer = "preflight OPTIONS access control origin credentials simple requests " * 3
    result = _score(
        [
            "same-origin policy",
            "Access-Control-Allow-Origin header",
            "preflight OPTIONS request",
            "simple vs non-simple requests",
            "credentials and Access-Control-Allow-Credentials",
        ],
        answer,
    )
    # Some keywords present -> partial coverage possible, but score must not be 5.0
    assert result.rubric.overall_score < 5.0


# ---------------------------------------------------------------------------
# Confirmed defect regressions: collisions, stuffing cap, long-phrase tolerance
# ---------------------------------------------------------------------------


def test_synonym_collision_sse_not_triggered_by_assessment() -> None:
    """The substring 'sse' in 'assessment' or 'assess' must not expand to SSE."""
    text = "the assessment process is designed to assess system architecture"
    expanded = _expand_synonyms(text)
    assert "server-sent events" not in expanded

    result = _score(
        [
            "WebSocket: bidirectional, full-duplex, single TCP connection",
            "SSE: unidirectional server-to-client, over HTTP",
        ],
        "The assessment process is designed to assess system architecture thoroughly.",
    )
    assert result.rubric.overall_score == 1.0


def test_synonym_collision_lora_not_triggered_by_flora() -> None:
    """The substring 'lora' in 'flora' or 'chloral' must not expand to LoRA."""
    text = "flora and fauna study in regional habitats"
    expanded = _expand_synonyms(text)
    assert "lora fine-tuning" not in expanded


def test_synonym_standalone_token_triggers_expansion() -> None:
    """A standalone abbreviation token must expand correctly."""
    text = "we choose sse for unidirectional feeds and ws for bi-directional chat"
    expanded = _expand_synonyms(text)
    assert "server-sent events" in expanded
    assert "websocket" in expanded


def test_verbatim_talking_points_keyword_stuffing_capped_at_three() -> None:
    """Dumping exact talking points verbatim without explanatory reasoning is capped at 3.0."""
    talking_points = [
        "same-origin policy",
        "Access-Control-Allow-Origin header",
        "preflight OPTIONS request",
        "simple vs non-simple requests",
        "credentials and Access-Control-Allow-Credentials",
    ]
    # Candidate simply pastes all talking-point labels joined by 'and'
    stuffed_answer = " and ".join(talking_points) + "."
    result = _score(talking_points, stuffed_answer)

    assert result.rubric.overall_score <= 3.0
    assert result.rubric.depth <= 2.5
    assert result.rubric.problem_solving <= 2.0
    assert any(
        "explain how these concepts work" in imp for imp in result.areas_for_improvement
    )


def test_full_coverage_with_explanatory_reasoning_not_capped() -> None:
    """Answers demonstrating full coverage with actual explanatory reasoning score high."""
    talking_points = [
        "same-origin policy",
        "Access-Control-Allow-Origin header",
        "preflight OPTIONS request",
        "simple vs non-simple requests",
        "credentials and Access-Control-Allow-Credentials",
    ]
    substantive_answer = (
        "The browser enforces the same-origin policy to restrict cross-domain requests. "
        "The server returns an Access-Control-Allow-Origin header to explicitly permit trusted origins. "
        "Before sending non-simple requests, browsers automatically dispatch a preflight OPTIONS request "
        "to check permissions. Requests are categorised into simple vs non-simple requests based on headers "
        "and methods. When handling sensitive cookies, credentials and Access-Control-Allow-Credentials "
        "must be configured on both sides."
    )
    result = _score(talking_points, substantive_answer)
    assert result.rubric.overall_score >= 4.0


def test_multiword_talking_point_not_penalized_for_incidental_word() -> None:
    """Omitting an incidental word ('sequence') from a 5-word talking point still matches."""
    talking_points = [
        "Saga: sequence of local transactions with compensating transactions",
        "choreography: services emit events and react to each other",
    ]
    # Omits 'sequence' from talking point 1, but covers saga, local transactions, compensating transactions
    answer = (
        "A Saga coordinates local transactions with compensating transactions for rollback. "
        "In choreography, services emit events and react to each other without central control."
    )
    result = _score(talking_points, answer)
    assert result.rubric.overall_score >= 2.5


def test_twenty_char_threshold_guards_against_fragments() -> None:
    """Fragments under 20 characters receive floor score, while concise complete answers score."""
    talking_points = ["same-origin policy", "preflight OPTIONS request"]

    # 19 characters - fragment
    fragment_result = _score(talking_points, "same-origin policy.")
    assert fragment_result.rubric.overall_score == 1.0

    # 24 characters - concise complete thought
    complete_result = _score(talking_points, "SOP enforced by browser.")
    assert complete_result.rubric.overall_score > 1.0
