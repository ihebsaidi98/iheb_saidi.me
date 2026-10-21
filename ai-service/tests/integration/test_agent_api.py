"""Integration tests for POST /v1/agent/answer."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.agent.orchestrator import AgenticRAGOrchestrator
from app.agent.schemas import AgentAnswerResponse, AgentMetadata
from app.config import Settings, get_settings
from app.dependencies import get_agent_orchestrator
from app.main import create_app
from app.rag.schemas import ChatSource
from app.rag.service import RAGConfigurationError, RAGGenerationError


@pytest.fixture
def mock_orchestrator() -> MagicMock:
    """Mock AgenticRAGOrchestrator for endpoint contract testing."""
    mock = MagicMock(spec=AgenticRAGOrchestrator)
    mock.answer = AsyncMock()
    return mock


@pytest.fixture
async def agent_client(
    test_settings: Settings, mock_orchestrator: MagicMock
) -> AsyncClient:
    """AsyncClient wired with overridden mock agent orchestrator."""
    test_settings.agentic_rag_enabled = True
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_agent_orchestrator] = lambda: mock_orchestrator

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_agent_answer_unauthorized(agent_client: AsyncClient) -> None:
    """Calling agent answer without internal token returns 401 Unauthorized."""
    resp = await agent_client.post(
        "/v1/agent/answer",
        json={"message": "What is Iheb's experience?"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_agent_answer_invalid_token(agent_client: AsyncClient) -> None:
    """Calling agent answer with invalid internal token returns 401 Unauthorized."""
    resp = await agent_client.post(
        "/v1/agent/answer",
        json={"message": "What is Iheb's experience?"},
        headers={"X-Internal-Token": "wrong-token"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_agent_answer_validation_errors(agent_client: AsyncClient) -> None:
    """Rejects empty message or message exceeding max length."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}

    # Empty message
    resp1 = await agent_client.post(
        "/v1/agent/answer",
        json={"message": ""},
        headers=headers,
    )
    assert resp1.status_code == 422

    # Message exceeding 500 characters
    resp2 = await agent_client.post(
        "/v1/agent/answer",
        json={"message": "a" * 501},
        headers=headers,
    )
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_agent_answer_feature_flag_disabled(
    test_settings: Settings, mock_orchestrator: MagicMock
) -> None:
    """Returns 503 AGENTIC_RAG_DISABLED when agentic_rag_enabled is False."""
    test_settings.agentic_rag_enabled = False
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_agent_orchestrator] = lambda: mock_orchestrator

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/v1/agent/answer",
            json={"message": "What is Iheb's experience?"},
            headers={"X-Internal-Token": "valid-test-internal-token"},
        )
        assert resp.status_code == 503
        data = resp.json()
        assert data["error"]["code"] == "AGENTIC_RAG_DISABLED"


@pytest.mark.asyncio
async def test_agent_answer_success(
    agent_client: AsyncClient, mock_orchestrator: MagicMock
) -> None:
    """Successful orchestration returns 200 with response contract and metadata."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_orchestrator.answer.return_value = AgentAnswerResponse(
        reply="Iheb has extensive Java and Spring Boot experience.",
        sources=[
            ChatSource(
                id="doc1#0",
                document_id="doc1",
                source="resume",
                title="Software Engineer",
                type="experience",
                score=0.88,
            )
        ],
        metadata=AgentMetadata(
            intent="portfolio_factual",
            subqueries=["What is Iheb's Java experience?"],
            subqueries_count=1,
            retrieval_count=1,
            abstained=False,
            execution_time_ms=12.5,
        ),
    )

    resp = await agent_client.post(
        "/v1/agent/answer",
        json={"message": "What is Iheb's Java experience?"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"] == "Iheb has extensive Java and Spring Boot experience."
    assert len(data["sources"]) == 1
    assert data["sources"][0]["id"] == "doc1#0"
    assert data["sources"][0]["title"] == "Software Engineer"
    assert data["metadata"]["intent"] == "portfolio_factual"
    assert data["metadata"]["subqueries"] == ["What is Iheb's Java experience?"]
    assert data["metadata"]["abstained"] is False


@pytest.mark.asyncio
async def test_agent_answer_configuration_error(
    agent_client: AsyncClient, mock_orchestrator: MagicMock
) -> None:
    """RAGConfigurationError converts to 503 SERVICE_UNAVAILABLE."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_orchestrator.answer.side_effect = RAGConfigurationError(
        "Vector store not initialized"
    )

    resp = await agent_client.post(
        "/v1/agent/answer",
        json={"message": "What is Iheb's experience?"},
        headers=headers,
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_agent_answer_generation_error(
    agent_client: AsyncClient, mock_orchestrator: MagicMock
) -> None:
    """RAGGenerationError converts to 502 GENERATION_ERROR."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_orchestrator.answer.side_effect = RAGGenerationError("Model generation failed")

    resp = await agent_client.post(
        "/v1/agent/answer",
        json={"message": "What is Iheb's experience?"},
        headers=headers,
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "GENERATION_ERROR"
