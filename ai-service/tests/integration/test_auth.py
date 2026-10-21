"""Integration tests for internal authentication enforcement."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_v1_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.get("/v1/info")
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "Invalid or missing" in data["error"]["message"]
    assert response.headers.get("X-Request-ID") is not None


@pytest.mark.asyncio
async def test_v1_rejects_invalid_token(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/info", headers={"X-Internal-Token": "bad-token-value"}
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_v1_rejects_invalid_bearer_token(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/info", headers={"Authorization": "Bearer bad-bearer"}
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_v1_accepts_valid_header_token(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/info",
        headers={"X-Internal-Token": "valid-test-internal-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "portfolio-ai-service"
    assert data["version"] == "0.1.0"
    assert data["phase"] == 2
    assert "internal_token_auth" in data["capabilities"]


@pytest.mark.asyncio
async def test_v1_accepts_valid_bearer_token(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/info",
        headers={"Authorization": "Bearer valid-test-internal-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "portfolio-ai-service"


# ---------------------------------------------------------------------------
# Additional hardening tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_v1_rejects_empty_string_token(client: AsyncClient) -> None:
    """An empty string X-Internal-Token must be rejected (not silently stripped to None)."""
    # httpx strips empty headers, so we verify that an absent header is also rejected
    response = await client.get("/v1/info", headers={"X-Internal-Token": " "})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_v1_rejects_bearer_prefix_only(client: AsyncClient) -> None:
    """'Authorization: Bearer ' with nothing after is equivalent to no token."""
    response = await client.get("/v1/info", headers={"Authorization": "Bearer "})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_v1_rejects_non_bearer_scheme(client: AsyncClient) -> None:
    """Authorization schemes other than Bearer must not grant access."""
    response = await client.get(
        "/v1/info",
        headers={"Authorization": "Basic valid-test-internal-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_v1_401_includes_www_authenticate_header(client: AsyncClient) -> None:
    """401 Unauthorized MUST include WWW-Authenticate: Bearer per RFC 7235."""
    response = await client.get("/v1/info")
    assert response.status_code == 401
    www_auth = response.headers.get("WWW-Authenticate")
    assert www_auth is not None
    assert "Bearer" in www_auth


@pytest.mark.asyncio
async def test_v1_401_error_message_is_generic(client: AsyncClient) -> None:
    """Error message must not hint whether token was missing vs. wrong (timing-safe)."""
    # Missing token
    r1 = await client.get("/v1/info")
    # Wrong token
    r2 = await client.get("/v1/info", headers={"X-Internal-Token": "totally-wrong"})
    assert r1.json()["error"]["message"] == r2.json()["error"]["message"]


@pytest.mark.asyncio
async def test_v1_rag_search_rejects_missing_token(client: AsyncClient) -> None:
    """Spot-check: /v1/rag/search is protected by the shared router-level dependency."""
    response = await client.post("/v1/rag/search", json={"query": "test"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_v1_rag_chat_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.post("/v1/rag/chat", json={"message": "hi"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_v1_agent_answer_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.post("/v1/agent/answer", json={"question": "hi"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_v1_copilot_match_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/copilot/match-job", json={"job_description": "engineer"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_v1_interview_start_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/interview/start",
        json={"track": "backend", "difficulty": "medium"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_auth_error_body_contains_no_token_echo(client: AsyncClient) -> None:
    """The 401 response body must not echo back any submitted token value."""
    sentinel = "SENTINEL_TOKEN_VALUE_XYZ_987"
    response = await client.get("/v1/info", headers={"X-Internal-Token": sentinel})
    assert response.status_code == 401
    assert sentinel not in response.text
