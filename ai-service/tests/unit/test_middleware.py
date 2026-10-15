"""Unit tests for middleware behaviors."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_id_generated_when_missing(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) > 10


@pytest.mark.asyncio
async def test_request_id_preserved_when_provided(client: AsyncClient) -> None:
    custom_id = "custom-test-trace-id-1234"
    response = await client.get("/health/live", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


@pytest.mark.asyncio
async def test_payload_size_limit_rejection(client: AsyncClient) -> None:
    # Test settings configure max_request_size_bytes=1024
    oversized_data = "x" * 2048
    response = await client.post(
        "/v1/info",
        headers={
            "X-Internal-Token": "valid-test-internal-token",
            "Content-Length": str(len(oversized_data)),
        },
        content=oversized_data,
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert "exceeds maximum allowed size" in data["error"]["message"]
