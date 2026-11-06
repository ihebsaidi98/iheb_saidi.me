"""Integration tests for POST /v1/rag/search and POST /v1/rag/chat."""

from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.dependencies import get_rag_service
from app.main import create_app
from app.rag.schemas import (
    ChatResponse,
    ChatSource,
    SearchResponse,
    SearchResultItem,
)
from app.rag.service import RAGConfigurationError, RAGGenerationError, RAGService


@pytest.fixture
def mock_rag_service() -> MagicMock:
    """Mock RAGService for deterministic endpoint contract tests."""
    mock = MagicMock(spec=RAGService)
    return mock


@pytest.fixture
async def rag_client(
    test_settings: Settings, mock_rag_service: MagicMock
) -> AsyncClient:
    """AsyncClient wired with overridden mock RAG service."""
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_rag_service] = lambda: mock_rag_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# --- Authentication Guard Tests ---


@pytest.mark.asyncio
async def test_search_unauthorized(rag_client: AsyncClient):
    """Calling search without internal token returns 401 Unauthorized."""
    resp = await rag_client.post("/v1/rag/search", json={"query": "test"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_chat_unauthorized(rag_client: AsyncClient):
    """Calling chat without internal token returns 401 Unauthorized."""
    resp = await rag_client.post("/v1/rag/chat", json={"message": "hello"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


# --- Validation Tests ---


@pytest.mark.asyncio
async def test_search_validation_errors(rag_client: AsyncClient):
    """Search request rejects empty query or out-of-bound limit."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}

    # Empty query
    resp1 = await rag_client.post("/v1/rag/search", json={"query": ""}, headers=headers)
    assert resp1.status_code == 422

    # Limit > 20
    resp2 = await rag_client.post(
        "/v1/rag/search", json={"query": "test", "limit": 25}, headers=headers
    )
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_chat_validation_errors(rag_client: AsyncClient):
    """Chat request rejects empty message or excess history turns."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}

    resp1 = await rag_client.post("/v1/rag/chat", json={"message": ""}, headers=headers)
    assert resp1.status_code == 422

    resp2 = await rag_client.post(
        "/v1/rag/chat",
        json={
            "message": "test",
            "history": [{"role": "user", "content": "hi"}] * 11,
        },
        headers=headers,
    )
    assert resp2.status_code == 422


# --- Successful Search & Chat Tests ---


@pytest.mark.asyncio
async def test_search_success(rag_client: AsyncClient, mock_rag_service: MagicMock):
    """Search returns valid SearchResponse."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_rag_service.search.return_value = SearchResponse(
        query="Tell me about Iheb's projects",
        results=[
            SearchResultItem(
                id="proj-1",
                documentId="project-x",
                source="projects.ts",
                type="project",
                title="Project X",
                summary="A cool project",
                text="Details about Project X",
                score=0.88,
            )
        ],
        total=1,
        index_version="2026.1",
    )

    resp = await rag_client.post(
        "/v1/rag/search",
        json={"query": "Tell me about Iheb's projects", "limit": 5},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "Tell me about Iheb's projects"
    assert data["total"] == 1
    assert data["results"][0]["id"] == "proj-1"
    assert data["results"][0]["documentId"] == "project-x"
    assert data["results"][0]["score"] == 0.88


@pytest.mark.asyncio
async def test_chat_success(rag_client: AsyncClient, mock_rag_service: MagicMock):
    """Chat returns exact contract { reply, sources }."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_rag_service.chat.return_value = ChatResponse(
        reply="Iheb Saidi is a software engineer experienced in TypeScript and Python.",
        sources=[ChatSource(id="profile", title="Profile", type="profile")],
    )

    resp = await rag_client.post(
        "/v1/rag/chat",
        json={"message": "What is Iheb's background?"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert (
        data["reply"]
        == "Iheb Saidi is a software engineer experienced in TypeScript and Python."
    )
    assert len(data["sources"]) == 1
    assert data["sources"][0]["id"] == "profile"


@pytest.mark.asyncio
async def test_chat_insufficient_evidence(
    rag_client: AsyncClient, mock_rag_service: MagicMock
):
    """Unrelated query returns safe canned refusal with empty sources."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_rag_service.chat.return_value = ChatResponse(
        reply="I don't have that information in my portfolio data.",
        sources=[],
    )

    resp = await rag_client.post(
        "/v1/rag/chat",
        json={"message": "What is the capital of Mars?"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"] == "I don't have that information in my portfolio data."
    assert data["sources"] == []


@pytest.mark.asyncio
async def test_chat_configuration_error_503(
    rag_client: AsyncClient, mock_rag_service: MagicMock
):
    """Missing Gemini API key or embedder failure returns 503."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_rag_service.chat.side_effect = RAGConfigurationError(
        "GEMINI_API_KEY is missing."
    )

    resp = await rag_client.post(
        "/v1/rag/chat",
        json={"message": "Hello"},
        headers=headers,
    )
    assert resp.status_code == 503
    data = resp.json()
    assert data["error"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_chat_generation_error_502(
    rag_client: AsyncClient, mock_rag_service: MagicMock
):
    """LLM failure returns 502 Bad Gateway."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_rag_service.chat.side_effect = RAGGenerationError("All models failed.")

    resp = await rag_client.post(
        "/v1/rag/chat",
        json={"message": "Hello"},
        headers=headers,
    )
    assert resp.status_code == 502
    data = resp.json()
    assert data["error"]["code"] == "GENERATION_ERROR"
