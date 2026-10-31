"""Integration tests for Mixed-Format Interview Simulator endpoints (/v1/interview/*)."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.dependencies import get_interview_service
from app.interview.schemas import (
    InterviewQuestion,
    SessionCompletionReport,
    StartInterviewResponse,
    SubmitAnswerAck,
)
from app.interview.service import InterviewSimulatorService
from app.main import create_app


@pytest.fixture
def mock_interview_service() -> MagicMock:
    """Mock InterviewSimulatorService for endpoint contract testing."""
    mock = MagicMock(spec=InterviewSimulatorService)
    mock.start_interview = AsyncMock()
    mock.submit_answer = AsyncMock()
    mock.complete_session = AsyncMock()
    return mock


@pytest.fixture
async def interview_client(
    test_settings: Settings, mock_interview_service: MagicMock
) -> AsyncClient:
    """AsyncClient wired with overridden mock interview service."""
    test_settings.interview_simulator_enabled = True
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_interview_service] = lambda: mock_interview_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# --- Authentication Guard Tests ---


@pytest.mark.asyncio
async def test_interview_start_unauthorized(interview_client: AsyncClient) -> None:
    """Calling interview start without internal token returns 401 Unauthorized."""
    resp = await interview_client.post(
        "/v1/interview/start",
        json={"track": "full_stack"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_interview_submit_unauthorized(interview_client: AsyncClient) -> None:
    """Calling submit-answer without internal token returns 401 Unauthorized."""
    resp = await interview_client.post(
        "/v1/interview/submit-answer",
        json={
            "session_id": "session-1",
            "session_token": "token-1",
            "question_id": "fs-mcq-01",
            "answer": "201 Created",
        },
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_interview_complete_unauthorized(interview_client: AsyncClient) -> None:
    """Calling complete without internal token returns 401 Unauthorized."""
    resp = await interview_client.post(
        "/v1/interview/complete",
        json={"session_id": "session-1", "session_token": "token-1"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


# --- Validation Tests ---


@pytest.mark.asyncio
async def test_interview_submit_validation_error(
    interview_client: AsyncClient,
) -> None:
    """Rejects empty answer."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    resp = await interview_client.post(
        "/v1/interview/submit-answer",
        json={
            "session_id": "session-1",
            "session_token": "token-1",
            "question_id": "fs-mcq-01",
            "answer": "",
        },
        headers=headers,
    )
    assert resp.status_code == 422


# --- Feature Flag Tests ---


@pytest.mark.asyncio
async def test_interview_disabled_by_feature_flag(
    test_settings: Settings, mock_interview_service: MagicMock
) -> None:
    """Returns 503 INTERVIEW_SIMULATOR_DISABLED when feature flag is disabled."""
    test_settings.interview_simulator_enabled = False
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_interview_service] = lambda: mock_interview_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        headers = {"X-Internal-Token": "valid-test-internal-token"}
        resp = await client.post(
            "/v1/interview/start",
            json={"track": "full_stack"},
            headers=headers,
        )
        assert resp.status_code == 503
        assert resp.json()["error"]["code"] == "INTERVIEW_SIMULATOR_DISABLED"


# --- Success Contract Tests ---


@pytest.mark.asyncio
async def test_interview_start_success(
    interview_client: AsyncClient, mock_interview_service: MagicMock
) -> None:
    """Successful start returns 200 with initial question and session token."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_interview_service.start_interview.return_value = StartInterviewResponse(
        session_id="session-test-123",
        session_token="token-abc-123",
        track="full_stack",
        total_questions=10,
        initial_question=InterviewQuestion(
            question_id="fs-mcq-01",
            question_number=1,
            total_questions=10,
            question_text="Which status code?",
            question_type="mcq",
            track="full_stack",
            topic="HTTP",
            options=["200", "201", "204", "301"],
        ),
    )

    resp = await interview_client.post(
        "/v1/interview/start",
        json={"track": "full_stack"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "session-test-123"
    assert data["session_token"] == "token-abc-123"
    assert data["total_questions"] == 10
    assert data["initial_question"]["question_id"] == "fs-mcq-01"


@pytest.mark.asyncio
async def test_interview_submit_success(
    interview_client: AsyncClient, mock_interview_service: MagicMock
) -> None:
    """Successful submit-answer returns 200 with blind acknowledgement."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_interview_service.submit_answer.return_value = SubmitAnswerAck(
        session_id="session-test-123",
        question_id="fs-mcq-01",
        question_number=1,
        answered_count=1,
        total_questions=10,
        is_complete=False,
        next_question=None,
    )

    resp = await interview_client.post(
        "/v1/interview/submit-answer",
        json={
            "session_id": "session-test-123",
            "session_token": "token-abc-123",
            "question_id": "fs-mcq-01",
            "answer": "201 Created",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "session-test-123"
    assert data["answered_count"] == 1
    assert data["is_complete"] is False


@pytest.mark.asyncio
async def test_interview_complete_success(
    interview_client: AsyncClient, mock_interview_service: MagicMock
) -> None:
    """Successful complete returns 200 with complete report."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_interview_service.complete_session.return_value = SessionCompletionReport(
        session_id="session-test-123",
        track="full_stack",
        score_out_of_100=90.0,
        mcq_score=45.0,
        written_score=45.0,
        mcq_results=[],
        written_results=[],
        topic_breakdown=[],
        overall_strengths=["Great work"],
        overall_improvements=[],
        total_questions=10,
    )

    resp = await interview_client.post(
        "/v1/interview/complete",
        json={
            "session_id": "session-test-123",
            "session_token": "token-abc-123",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["score_out_of_100"] == 90.0
    assert data["session_id"] == "session-test-123"
