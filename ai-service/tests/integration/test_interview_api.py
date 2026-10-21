"""Integration tests for Adaptive Interview Simulator endpoints (/v1/interview/*)."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.dependencies import get_interview_service
from app.interview.schemas import (
    InterviewQuestion,
    RubricScore,
    StartInterviewResponse,
    SubmitAnswerResponse,
)
from app.interview.service import InterviewSimulatorService
from app.main import create_app


@pytest.fixture
def mock_interview_service() -> MagicMock:
    """Mock InterviewSimulatorService for endpoint contract testing."""
    mock = MagicMock(spec=InterviewSimulatorService)
    mock.start_interview = AsyncMock()
    mock.submit_answer = AsyncMock()
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
            "question_id": "fs-01",
            "answer": "A detailed technical answer about microservices.",
        },
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


# --- Validation Tests ---


@pytest.mark.asyncio
async def test_interview_submit_validation_error(
    interview_client: AsyncClient,
) -> None:
    """Rejects answer shorter than 10 characters."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    resp = await interview_client.post(
        "/v1/interview/submit-answer",
        json={
            "session_id": "session-1",
            "question_id": "fs-01",
            "answer": "Too short",
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
    """Successful start returns 200 with initial question."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_interview_service.start_interview.return_value = StartInterviewResponse(
        session_id="session-test-123",
        track="full_stack",
        difficulty="senior",
        initial_question=InterviewQuestion(
            question_id="fs-01",
            question_text="How did you architect AgroRetail OS?",
            track="full_stack",
            difficulty="senior",
            expected_talking_points=["multi-tenancy", "JWT"],
        ),
    )

    resp = await interview_client.post(
        "/v1/interview/start",
        json={"track": "full_stack", "difficulty": "senior"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "session-test-123"
    assert data["initial_question"]["question_id"] == "fs-01"


@pytest.mark.asyncio
async def test_interview_submit_success(
    interview_client: AsyncClient, mock_interview_service: MagicMock
) -> None:
    """Successful submit-answer returns 200 with rubric scores and feedback."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_interview_service.submit_answer.return_value = SubmitAnswerResponse(
        session_id="session-test-123",
        question_id="fs-01",
        rubric=RubricScore(
            technical_depth=4.5,
            architecture_accuracy=4.0,
            clarity=4.2,
            portfolio_relevance=4.5,
            overall_score=4.3,
        ),
        strengths=["Accurately addressed tenant isolation"],
        areas_for_improvement=["Could mention database migration tooling"],
        sample_ideal_answer="Ideal reference response.",
        next_question=None,
    )

    resp = await interview_client.post(
        "/v1/interview/submit-answer",
        json={
            "session_id": "session-test-123",
            "question_id": "fs-01",
            "answer": "In AgroRetail OS, tenant isolation is maintained via tenant-aware headers and JWT claims.",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["rubric"]["overall_score"] == 4.3
    assert len(data["strengths"]) == 1
    assert data["sample_ideal_answer"] == "Ideal reference response."
