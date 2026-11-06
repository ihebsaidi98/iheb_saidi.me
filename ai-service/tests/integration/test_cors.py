"""Integration tests for CORS policy enforcement."""

import pytest
from httpx import AsyncClient

ALLOWED_ORIGIN = "http://localhost:3000"
UNKNOWN_ORIGIN = "https://evil.example.com"
TOKEN = "X-Internal-Token"
VALID_TOKEN = "valid-test-internal-token"


@pytest.mark.asyncio
async def test_preflight_from_allowed_origin_succeeds(client: AsyncClient) -> None:
    """OPTIONS preflight from an allowed origin must return CORS allow headers."""
    response = await client.options(
        "/v1/rag/search",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, X-Internal-Token",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == ALLOWED_ORIGIN
    allowed_methods = response.headers.get("Access-Control-Allow-Methods", "")
    assert "POST" in allowed_methods


@pytest.mark.asyncio
async def test_preflight_from_unknown_origin_denied(client: AsyncClient) -> None:
    """OPTIONS preflight from an unknown origin must NOT include ACAO header."""
    response = await client.options(
        "/v1/rag/search",
        headers={
            "Origin": UNKNOWN_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.headers.get("Access-Control-Allow-Origin") != UNKNOWN_ORIGIN
    assert response.headers.get("Access-Control-Allow-Origin") != "*"


@pytest.mark.asyncio
async def test_preflight_exposes_request_id_header(client: AsyncClient) -> None:
    """X-Request-ID must be listed in Access-Control-Allow-Headers for correlation."""
    response = await client.options(
        "/v1/info",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Request-ID",
        },
    )
    assert response.status_code == 200
    allowed_headers = response.headers.get("Access-Control-Allow-Headers", "")
    assert "x-request-id" in allowed_headers.lower()


@pytest.mark.asyncio
async def test_cross_origin_get_allowed_origin_has_acao_header(
    client: AsyncClient,
) -> None:
    """GET from an allowed origin must carry Access-Control-Allow-Origin."""
    response = await client.get(
        "/health/live",
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == ALLOWED_ORIGIN


@pytest.mark.asyncio
async def test_cross_origin_get_unknown_origin_no_acao_header(
    client: AsyncClient,
) -> None:
    """GET from an unknown origin must NOT carry Access-Control-Allow-Origin."""
    response = await client.get(
        "/health/live",
        headers={"Origin": UNKNOWN_ORIGIN},
    )
    assert response.status_code == 200
    acao = response.headers.get("Access-Control-Allow-Origin")
    assert acao != UNKNOWN_ORIGIN
    assert acao != "*"


@pytest.mark.asyncio
async def test_allowed_origin_without_token_still_rejected(
    client: AsyncClient,
) -> None:
    """An allowed CORS origin must NOT bypass authentication."""
    response = await client.get(
        "/v1/info",
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_allowed_origin_with_wrong_token_still_rejected(
    client: AsyncClient,
) -> None:
    """A valid CORS origin with an invalid token must still receive 401."""
    response = await client.get(
        "/v1/info",
        headers={
            "Origin": ALLOWED_ORIGIN,
            TOKEN: "wrong-token-value",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unknown_origin_with_valid_token_still_authenticated(
    client: AsyncClient,
) -> None:
    """Server-side calls without Origin header are not bound by CORS."""
    response = await client.get(
        "/v1/info",
        headers={
            "Origin": UNKNOWN_ORIGIN,
            TOKEN: VALID_TOKEN,
        },
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_413_from_cross_origin_includes_cors_headers(
    client: AsyncClient,
) -> None:
    """413 from RequestSizeLimitMiddleware must include CORS headers (middleware order test)."""
    response = await client.post(
        "/v1/rag/search",
        content=b"x" * 4096,
        headers={
            "Origin": ALLOWED_ORIGIN,
            TOKEN: VALID_TOKEN,
            "Content-Length": "4096",
        },
    )
    assert response.status_code == 413
    assert response.headers.get("Access-Control-Allow-Origin") == ALLOWED_ORIGIN


def test_wildcard_origin_rejected_by_settings() -> None:
    """Settings must raise ValidationError if '*' is in allowed_origins."""
    import pytest as _pytest
    from pydantic import ValidationError

    from app.config import Settings

    with _pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins=["*"],  # type: ignore[arg-type]
        )
