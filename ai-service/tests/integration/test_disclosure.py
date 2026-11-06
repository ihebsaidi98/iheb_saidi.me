"""Non-disclosure tests for HTTP error responses and critical logs."""

import logging
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.dependencies import get_agent_orchestrator, get_rag_service
from app.main import create_app
from app.rag.service import RAGConfigurationError, RAGGenerationError, RAGService

INTERNAL_SECRET_SENTINEL = "INTERNAL_SECRET_SENTINEL"
GEMINI_API_KEY_SENTINEL = "GEMINI_API_KEY_SENTINEL"
USER_PROMPT_SENTINEL = "USER_PROMPT_SENTINEL"
AUTH_HEADERS = {"X-Internal-Token": "valid-test-internal-token"}


@pytest.fixture
async def disclosure_rag_client(test_settings: Settings) -> AsyncClient:
    mock_rag = MagicMock(spec=RAGService)
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_rag_service] = lambda: mock_rag

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        client.mock_rag = mock_rag  # type: ignore[attr-defined]
        yield client


@pytest.mark.asyncio
async def test_rag_chat_config_error_does_not_leak_sentinels(
    disclosure_rag_client: AsyncClient,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]
    mock_rag.chat.side_effect = RAGConfigurationError(
        f"Missing key {GEMINI_API_KEY_SENTINEL} and {INTERNAL_SECRET_SENTINEL}"
    )

    resp = await disclosure_rag_client.post(
        "/v1/rag/chat",
        json={"message": "Hello"},
        headers=AUTH_HEADERS,
    )

    body = resp.text
    assert resp.status_code == 503
    assert GEMINI_API_KEY_SENTINEL not in body
    assert INTERNAL_SECRET_SENTINEL not in body
    assert resp.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_rag_chat_generation_error_does_not_leak_sentinels(
    disclosure_rag_client: AsyncClient,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]
    mock_rag.chat.side_effect = RAGGenerationError(
        f"Model failed with {GEMINI_API_KEY_SENTINEL}"
    )

    resp = await disclosure_rag_client.post(
        "/v1/rag/chat",
        json={"message": "Hello"},
        headers=AUTH_HEADERS,
    )

    body = resp.text
    assert resp.status_code == 502
    assert GEMINI_API_KEY_SENTINEL not in body
    assert resp.json()["error"]["code"] == "GENERATION_ERROR"


@pytest.mark.asyncio
async def test_rag_chat_unexpected_error_does_not_leak_sentinels(
    disclosure_rag_client: AsyncClient,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]
    mock_rag.chat.side_effect = RuntimeError(
        f"Crash {INTERNAL_SECRET_SENTINEL} token={GEMINI_API_KEY_SENTINEL}"
    )

    resp = await disclosure_rag_client.post(
        "/v1/rag/chat",
        json={"message": "Hello"},
        headers=AUTH_HEADERS,
    )

    body = resp.text
    assert resp.status_code == 502
    assert INTERNAL_SECRET_SENTINEL not in body
    assert GEMINI_API_KEY_SENTINEL not in body


@pytest.mark.asyncio
async def test_agent_generation_error_does_not_leak_sentinels(
    test_settings: Settings,
) -> None:
    test_settings.agentic_rag_enabled = True
    mock_orchestrator = MagicMock()
    mock_orchestrator.answer.side_effect = RAGGenerationError(
        f"Upstream {GEMINI_API_KEY_SENTINEL}"
    )

    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_agent_orchestrator] = lambda: mock_orchestrator

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/v1/agent/answer",
            json={"message": "What is Iheb's experience?"},
            headers=AUTH_HEADERS,
        )

    body = resp.text
    assert resp.status_code == 502
    assert GEMINI_API_KEY_SENTINEL not in body
    assert resp.json()["error"]["code"] == "GENERATION_ERROR"


@pytest.mark.asyncio
async def test_rag_route_error_logs_redact_sentinels(
    disclosure_rag_client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]
    mock_rag.chat.side_effect = RuntimeError(
        f"Boom GEMINI_API_KEY={GEMINI_API_KEY_SENTINEL}"
    )

    with caplog.at_level(logging.ERROR, logger="ai_service.api.v1.rag"):
        resp = await disclosure_rag_client.post(
            "/v1/rag/chat",
            json={"message": "Hello"},
            headers=AUTH_HEADERS,
        )

    assert resp.status_code == 502
    log_blob = " ".join(record.getMessage() for record in caplog.records)
    assert GEMINI_API_KEY_SENTINEL not in log_blob


@pytest.mark.asyncio
async def test_rag_route_error_logs_chained_exceptions_redact_sentinels(
    disclosure_rag_client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]

    class CustomUpstreamError(Exception):
        def __init__(self, code: int, msg: str) -> None:
            super().__init__(f"Upstream {code}: {msg}")
            self.code = code
            self.msg = msg

    inner_secret_val = f"vault-key-{INTERNAL_SECRET_SENTINEL}"
    outer_secret_val = f"bearer-token-{GEMINI_API_KEY_SENTINEL}"

    def raise_chained(*args: object, **kwargs: object) -> None:
        try:
            raise CustomUpstreamError(403, f"key={inner_secret_val}")
        except Exception as inner:
            raise RuntimeError(f"Service token={outer_secret_val}") from inner

    mock_rag.chat.side_effect = raise_chained

    formatter = logging.Formatter("%(levelname)s - %(message)s")
    with caplog.at_level(logging.ERROR, logger="ai_service.api.v1.rag"):
        resp = await disclosure_rag_client.post(
            "/v1/rag/chat",
            json={"message": "Hello"},
            headers=AUTH_HEADERS,
        )

    assert resp.status_code == 502
    # Verify both message text and formatted exception traceback contain zero secret values
    for record in caplog.records:
        formatted = formatter.format(record)
        assert inner_secret_val not in formatted
        assert outer_secret_val not in formatted
        assert "[REDACTED]" in formatted


@pytest.mark.asyncio
async def test_validation_422_does_not_leak_user_sensitive_data(
    disclosure_rag_client: AsyncClient,
) -> None:
    custom_req_id = "req-sec-audit-422-test"
    resp = await disclosure_rag_client.post(
        "/v1/rag/search",
        json={
            "query": "valid-query",
            "limit": 99999,  # Invalid limit out of range (> 20)
            "threshold": USER_PROMPT_SENTINEL,  # Invalid type (expected float)
        },
        headers={**AUTH_HEADERS, "X-Request-ID": custom_req_id},
    )

    assert resp.status_code == 422
    assert resp.headers.get("X-Request-ID") == custom_req_id
    body = resp.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["request_id"] == custom_req_id

    # The raw user values and sentinels must NOT appear in the response
    assert USER_PROMPT_SENTINEL not in resp.text
    assert "99999" not in resp.text
    # Must preserve helpful field indicator and safe category
    assert "limit" in body["error"]["message"]
    assert "threshold" in body["error"]["message"]


@pytest.mark.asyncio
async def test_validation_422_extra_field_redacts_sensitive_keys(
    disclosure_rag_client: AsyncClient,
) -> None:
    resp = await disclosure_rag_client.post(
        "/v1/rag/search",
        json={
            "query": "What is Iheb's background?",
            f"extra_{INTERNAL_SECRET_SENTINEL}": "malicious_payload",
        },
        headers=AUTH_HEADERS,
    )

    assert resp.status_code == 422
    assert INTERNAL_SECRET_SENTINEL not in resp.text
    assert "malicious_payload" not in resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_rag_logs_contain_no_user_prompts(
    disclosure_rag_client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]
    from app.rag.schemas import ChatResponse

    mock_rag.chat.return_value = ChatResponse(
        reply="Iheb has extensive experience.",
        sources=[],
    )

    with caplog.at_level(logging.DEBUG, logger="ai_service"):
        resp = await disclosure_rag_client.post(
            "/v1/rag/chat",
            json={"message": f"Hello {USER_PROMPT_SENTINEL}"},
            headers=AUTH_HEADERS,
        )

    assert resp.status_code == 200
    all_logs = " ".join(record.getMessage() for record in caplog.records)
    assert USER_PROMPT_SENTINEL not in all_logs


@pytest.mark.asyncio
async def test_rag_search_error_does_not_leak_internal_exception(
    disclosure_rag_client: AsyncClient,
) -> None:
    mock_rag: MagicMock = disclosure_rag_client.mock_rag  # type: ignore[attr-defined]
    mock_rag.search.side_effect = RAGConfigurationError(
        f"Database connect failed with {INTERNAL_SECRET_SENTINEL}"
    )

    resp = await disclosure_rag_client.post(
        "/v1/rag/search",
        json={"query": "experience"},
        headers=AUTH_HEADERS,
    )

    assert resp.status_code == 503
    assert INTERNAL_SECRET_SENTINEL not in resp.text
    assert resp.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
