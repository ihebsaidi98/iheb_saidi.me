"""Tests for the completion-time LLM budget (AUD-03).

Context: the completion report enriches up to 5 open-ended answers with a
sequential Gemini call, each bounded by ``request_timeout_seconds`` (15 s by
default). Nothing bounded the *sum*, so a slow provider could hold the session
lock for ~75 s while the Next.js client gave up after 30 s.

These tests pin the new contract:

  * a single global deadline (``COMPLETION_LLM_BUDGET_SECONDS``) bounds all LLM
    enrichment of one completion;
  * the remaining budget is re-read before every call and shrinking;
  * when the budget is exhausted the deterministic rubric is kept and the report
    is still produced;
  * failures and per-call timeouts never fail the request;
  * ``last_activity`` is refreshed by the completion itself;
  * the report stays cached and idempotent, and the lock is always released;
  * the Gemini client is created with a real HTTP timeout (milliseconds).

No test performs a network call: the Gemini client is always a deterministic
fake, and the client factory is exercised with ``genai.Client`` monkeypatched.
"""

import asyncio
import time
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from google.genai import types
from pydantic import SecretStr

from app.core import gemini_client as gemini_module
from app.interview import service as interview_service_module
from app.interview.questions import get_questions_for_session
from app.interview.schemas import CompleteSessionRequest
from app.interview.service import (
    _ACTIVE_SESSIONS,
    ActiveSession,
    InterviewSimulatorService,
    clear_active_sessions,
)

TRACK = "backend"


# ---------------------------------------------------------------------------
# Test doubles — deterministic, no network
# ---------------------------------------------------------------------------


class _FakeSettings:
    """Minimal settings surface used by the completion path."""

    def __init__(self, request_timeout_seconds: float = 5.0) -> None:
        self.request_timeout_seconds = request_timeout_seconds
        self.gemini_chat_model = "fake-model"
        self.gemini_api_key = SecretStr("fake-key")


class _RecordingGemini:
    """Gemini stand-in that records calls and can be slow, or fail.

    ``generate_content`` is synchronous because the production code runs it in
    a worker thread through ``asyncio.to_thread``.
    """

    def __init__(self, delay: float = 0.0, fail: bool = False) -> None:
        self.delay = delay
        self.fail = fail
        self.calls: list[float] = []
        self.models = self  # production code calls ``client.models.generate_content``

    def generate_content(self, **_kwargs: Any) -> Any:
        self.calls.append(time.monotonic())
        if self.delay:
            time.sleep(self.delay)
        if self.fail:
            raise RuntimeError("gemini unavailable")
        response = MagicMock()
        response.text = "STRENGTH: Explains the concept clearly.\nIMPROVEMENT: Add a concrete metric."
        return response


def _service(client: Any, timeout: float = 5.0) -> InterviewSimulatorService:
    return InterviewSimulatorService(
        store=MagicMock(),
        settings=_FakeSettings(request_timeout_seconds=timeout),  # type: ignore[arg-type]
        gemini_client=client,
    )


def _answer_for(question: dict) -> str:
    """Answer that guarantees non-zero coverage, so enrichment is attempted."""
    points = question.get("expected_talking_points") or []
    substance = "These concepts work together in practice to keep systems correct and fast."
    return f"{' '.join(points)} {substance}".strip()


def _make_session() -> ActiveSession:
    """Register a fully answered session built directly from the question bank."""
    questions = get_questions_for_session(TRACK)
    answers: dict[str, str] = {}
    for question in questions:
        if question["question_type"] == "mcq":
            options = question.get("options") or []
            index = question.get("correct_answer_index") or 0
            answers[question["question_id"]] = (
                options[index] if index < len(options) else "unknown"
            )
        else:
            answers[question["question_id"]] = _answer_for(question)

    session = ActiveSession(
        session_id="session-budget-test",
        session_token="t" * 32,
        track=TRACK,  # type: ignore[arg-type]
        question_order=[q["question_id"] for q in questions],
    )
    session.answers = answers
    _ACTIVE_SESSIONS[session.session_id] = session
    return session


def _complete(service: InterviewSimulatorService, session: ActiveSession) -> Any:
    return asyncio.run(
        service.complete_session(
            CompleteSessionRequest(
                session_id=session.session_id,
                session_token=session.session_token,
            )
        )
    )


@pytest.fixture(autouse=True)
def _clean_state() -> Any:
    clear_active_sessions()
    yield
    clear_active_sessions()


# ---------------------------------------------------------------------------
# 1-2. Global budget, including individually slow calls
# ---------------------------------------------------------------------------


def test_global_budget_stops_enrichment_after_deadline(monkeypatch: pytest.MonkeyPatch) -> None:
    """With a 0.25 s budget and 0.12 s calls, enrichment must stop well before 5 calls."""
    monkeypatch.setattr(interview_service_module, "COMPLETION_LLM_BUDGET_SECONDS", 0.25)

    client = _RecordingGemini(delay=0.12)
    service = _service(client)
    session = _make_session()

    started = time.monotonic()
    report = _complete(service, session)
    elapsed = time.monotonic() - started

    assert 1 <= len(client.calls) < 5, (
        f"expected the global budget to cut enrichment short, got {len(client.calls)} calls"
    )
    assert elapsed < 1.0, f"completion took {elapsed:.2f}s despite a 0.25s enrichment budget"
    assert len(report.written_results) == 5, "every written answer must still be scored"
    assert 0.0 <= report.score_out_of_100 <= 100.0


def test_budget_is_exhausted_by_one_slow_call_that_times_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A call that outlives the whole budget cannot be followed by another call."""
    monkeypatch.setattr(interview_service_module, "COMPLETION_LLM_BUDGET_SECONDS", 0.2)

    client = _RecordingGemini(delay=0.4)  # slower than the whole budget
    service = _service(client, timeout=5.0)
    session = _make_session()

    started = time.monotonic()
    report = _complete(service, session)
    elapsed = time.monotonic() - started

    assert len(client.calls) == 1, (
        f"only the first question may start an LLM call, got {len(client.calls)}"
    )
    assert elapsed < 1.0
    assert len(report.written_results) == 5


# ---------------------------------------------------------------------------
# 3. Deterministic fallback once the budget is gone
# ---------------------------------------------------------------------------


def test_enrichment_skipped_entirely_when_budget_is_zero(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No budget => no Gemini call at all, but the deterministic report is intact."""
    monkeypatch.setattr(interview_service_module, "COMPLETION_LLM_BUDGET_SECONDS", 0.0)

    client = _RecordingGemini()
    service = _service(client)
    session = _make_session()

    report = _complete(service, session)

    assert client.calls == [], "no Gemini call may be made once the budget is exhausted"
    assert len(report.written_results) == 5
    assert all(r.rubric.overall_score >= 1.0 for r in report.written_results)
    assert not any(
        "Explains the concept clearly" in strength
        for result in report.written_results
        for strength in result.strengths
    ), "the LLM-only feedback must not appear when enrichment was skipped"


# ---------------------------------------------------------------------------
# 4. Report integrity on LLM failure / per-call timeout
# ---------------------------------------------------------------------------


def test_report_is_returned_when_llm_raises() -> None:
    """A failing provider degrades to deterministic feedback, never a 5xx."""
    client = _RecordingGemini(fail=True)
    service = _service(client)
    session = _make_session()

    report = _complete(service, session)

    assert len(client.calls) == 5, "each eligible open-ended answer is attempted once"
    assert len(report.written_results) == 5
    assert 0.0 <= report.score_out_of_100 <= 100.0


def test_slow_call_is_bounded_by_request_timeout() -> None:
    """A call slower than request_timeout_seconds is abandoned, not awaited forever."""
    client = _RecordingGemini(delay=0.3)
    service = _service(client, timeout=0.05)  # per-call bound
    session = _make_session()

    started = time.monotonic()
    report = _complete(service, session)
    elapsed = time.monotonic() - started

    # 5 questions x 0.05 s bound; without the bound this would take 1.5 s.
    assert elapsed < 1.0, f"completion took {elapsed:.2f}s with a 0.05s per-call bound"
    assert len(client.calls) == 5
    assert len(report.written_results) == 5


# ---------------------------------------------------------------------------
# 5. The Gemini client carries a real HTTP timeout
# ---------------------------------------------------------------------------


def test_gemini_client_is_created_with_http_timeout_in_milliseconds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HttpOptions.timeout is milliseconds in google-genai, so 12 s must be 12000."""
    captured: dict[str, Any] = {}

    def _fake_client(**kwargs: Any) -> Any:
        captured.update(kwargs)
        return MagicMock()

    monkeypatch.setattr(gemini_module.genai, "Client", _fake_client)
    gemini_module.reset_gemini_client()
    try:
        gemini_module.get_gemini_client(_FakeSettings(request_timeout_seconds=12.0))  # type: ignore[arg-type]
    finally:
        gemini_module.reset_gemini_client()

    http_options = captured.get("http_options")
    assert isinstance(http_options, types.HttpOptions), (
        "the client must be created with explicit http_options"
    )
    assert http_options.timeout == 12_000, (
        f"timeout={http_options.timeout} must be milliseconds (SDK divides by 1000)"
    )


# ---------------------------------------------------------------------------
# 6. Session TTL bookkeeping
# ---------------------------------------------------------------------------


def test_completion_refreshes_last_activity() -> None:
    """Completion counts as activity: an old session must not be pruned mid-report."""
    service = _service(_RecordingGemini())
    session = _make_session()
    session.last_activity = time.time() - 3600

    _complete(service, session)

    assert session.last_activity > time.time() - 60, (
        "last_activity must be refreshed by complete_session"
    )


# ---------------------------------------------------------------------------
# 7. Idempotence and cache
# ---------------------------------------------------------------------------


def test_second_completion_returns_cached_report_without_new_llm_calls() -> None:
    client = _RecordingGemini()
    service = _service(client)
    session = _make_session()

    first = _complete(service, session)
    calls_after_first = len(client.calls)
    second = _complete(service, session)

    assert second is first, "the cached report object must be returned"
    assert len(client.calls) == calls_after_first, "a cached report must not re-call Gemini"
    assert session.completed is True


# ---------------------------------------------------------------------------
# 8-9. Lock release and unchanged authorization contract
# ---------------------------------------------------------------------------


def test_lock_is_released_when_scoring_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    service = _service(_RecordingGemini())
    session = _make_session()

    async def _boom(_session: ActiveSession) -> Any:
        raise RuntimeError("scoring exploded")

    monkeypatch.setattr(service, "_build_completion_report", _boom)

    with pytest.raises(RuntimeError):
        _complete(service, session)

    assert session.lock.locked() is False, "the session lock must be released on error"
    assert session.completed is False


def test_bad_token_still_rejected_and_lock_released() -> None:
    service = _service(_RecordingGemini())
    session = _make_session()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            service.complete_session(
                CompleteSessionRequest(
                    session_id=session.session_id,
                    session_token="wrong-token",
                )
            )
        )

    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "TOKEN_MISMATCH"
    assert session.lock.locked() is False
