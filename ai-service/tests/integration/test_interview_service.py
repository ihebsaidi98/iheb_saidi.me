"""Integration tests for InterviewSimulatorService with real vector store."""

from unittest.mock import MagicMock

import pytest

from app.config import Settings
from app.interview.schemas import StartInterviewRequest, SubmitAnswerRequest
from app.interview.service import InterviewSimulatorService
from app.rag.store import PortfolioVectorStore


@pytest.fixture
def real_vector_store() -> PortfolioVectorStore:
    """Load real precomputed portfolio vector store."""
    return PortfolioVectorStore.from_file()


@pytest.mark.asyncio
async def test_interview_service_start_session(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Starting an interview session yields valid session ID and initial question."""
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
    )

    req = StartInterviewRequest(track="backend_architecture", difficulty="senior")
    res = await service.start_interview(req)

    assert res.session_id.startswith("session-")
    assert res.track == "backend_architecture"
    assert res.difficulty == "senior"
    assert res.initial_question.question_id is not None
    assert len(res.initial_question.expected_talking_points) > 0


@pytest.mark.asyncio
async def test_interview_service_submit_strong_answer(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Comprehensive answer matching expected concepts scores highly and adapts difficulty."""
    mock_client = MagicMock()
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    # Question be-01 is Novatek high-frequency telemetry
    req = SubmitAnswerRequest(
        session_id="session-test",
        question_id="be-01",
        answer=(
            "At Novatek, we handled high-frequency telemetry by implementing asynchronous Spring Boot consumers "
            "with message queuing via Kafka, caching active device states in Redis, and executing batch database insertions "
            "to PostgreSQL using tuned HikariCP connection pools to avoid bottlenecks."
        ),
    )
    res = await service.submit_answer(req)

    assert res.rubric.overall_score >= 3.8
    assert res.rubric.technical_depth >= 4.0
    assert len(res.strengths) > 0
    assert len(res.sample_ideal_answer) > 20
    assert res.next_question is not None


@pytest.mark.asyncio
async def test_interview_service_submit_weak_answer(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Vague or brief answer missing technical points scores lower with improvement feedback."""
    service = InterviewSimulatorService(
        store=real_vector_store,
        settings=test_settings,
    )

    req = SubmitAnswerRequest(
        session_id="session-test",
        question_id="be-01",
        answer="I just used a normal SQL database and ran some queries when data arrived.",
    )
    res = await service.submit_answer(req)

    assert res.rubric.overall_score <= 3.0
    assert len(res.areas_for_improvement) > 0
    assert len(res.sample_ideal_answer) > 20
