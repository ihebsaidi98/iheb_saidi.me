"""Integration tests for health endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_live_endpoint(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}
    assert response.headers.get("X-Request-ID") is not None


@pytest.mark.asyncio
async def test_health_ready_endpoint(client: AsyncClient) -> None:
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["service"] == "portfolio-ai-service"
    assert data["version"] == "0.1.0"
    assert data["environment"] == "test"
    assert data["gemini_configured"] is True


@pytest.mark.asyncio
async def test_health_endpoints_require_no_auth(client: AsyncClient) -> None:
    # Explicitly test that unauthenticated requests to /health/* succeed
    live_res = await client.get("/health/live")
    assert live_res.status_code == 200

    ready_res = await client.get("/health/ready")
    assert ready_res.status_code == 200
