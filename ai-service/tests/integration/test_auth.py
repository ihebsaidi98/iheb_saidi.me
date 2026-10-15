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
    assert data["phase"] == 1
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
