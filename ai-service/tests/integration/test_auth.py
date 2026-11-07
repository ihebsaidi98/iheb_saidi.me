"""Integration tests for internal authentication enforcement."""

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.config import Settings, get_settings
from app.main import create_app


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


# ---------------------------------------------------------------------------
# H2 — the development fallback token is no longer a shared secret
# ---------------------------------------------------------------------------


_LEGACY_DEV_TOKEN = "dev-internal-token-change-in-production"


def _client_for(settings: Settings) -> AsyncClient:
    """Build a client bound to explicit settings (lifespan is not started)."""
    app = create_app(settings=settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")


@pytest.mark.asyncio
async def test_legacy_dev_token_rejected_when_no_token_is_configured() -> None:
    """H2: the former well-known default token must not authenticate anymore."""
    settings = Settings(
        environment="development",
        _env_file=None,
        ai_service_token=SecretStr(""),
        gemini_api_key=SecretStr("mock-dev-gemini-key"),
    )
    async with _client_for(settings) as client:
        response = await client.get(
            "/v1/info", headers={"X-Internal-Token": _LEGACY_DEV_TOKEN}
        )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_no_request_accepted_when_no_token_is_configured() -> None:
    """An unconfigured service must reject every caller (fail closed)."""
    settings = Settings(
        environment="development",
        _env_file=None,
        ai_service_token=SecretStr(""),
        gemini_api_key=SecretStr("mock-dev-gemini-key"),
    )
    async with _client_for(settings) as client:
        without_header = await client.get("/v1/info")
        with_empty_header = await client.get(
            "/v1/info", headers={"X-Internal-Token": ""}
        )
        with_bearer = await client.get(
            "/v1/info", headers={"Authorization": f"Bearer {_LEGACY_DEV_TOKEN}"}
        )
    assert without_header.status_code == 401
    assert with_empty_header.status_code == 401
    assert with_bearer.status_code == 401


@pytest.mark.asyncio
async def test_explicitly_configured_token_authenticates_in_development() -> None:
    """Local development works with an explicit shared token, and only that one."""
    explicit = "expl-dev-shared-secret-0123456789abcdef"
    settings = Settings(
        environment="development",
        _env_file=None,
        ai_service_token=SecretStr(explicit),
        gemini_api_key=SecretStr("mock-dev-gemini-key"),
    )
    async with _client_for(settings) as client:
        accepted = await client.get("/v1/info", headers={"X-Internal-Token": explicit})
        legacy = await client.get(
            "/v1/info", headers={"X-Internal-Token": _LEGACY_DEV_TOKEN}
        )
    assert accepted.status_code == 200
    assert legacy.status_code == 401
    assert explicit not in accepted.text, (
        "a successful response must not echo the token"
    )
