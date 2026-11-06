"""Integration tests for health endpoints."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.config import Settings, get_settings
from app.dependencies import set_vector_store
from app.main import create_app


@pytest.mark.asyncio
async def test_health_live_endpoint(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}
    assert response.headers.get("X-Request-ID") is not None


@pytest.mark.asyncio
async def test_health_ready_endpoint_success(client: AsyncClient) -> None:
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["service"] == "portfolio-ai-service"
    assert data["version"] == "0.1.0"
    assert data["environment"] == "test"
    assert data["gemini_configured"] is True
    assert data["index_loaded"] is True
    assert data["index_records"] > 0
    # Security: Ensure internal filesystem paths and secrets are not leaked
    raw_body = response.text
    assert "src/data" not in raw_body
    assert "AIza" not in raw_body


@pytest.mark.asyncio
async def test_health_ready_fails_when_index_unloaded(tmp_path: Path) -> None:
    """When vector store index fails to load, /health/ready returns 503, but /health/live remains 200."""
    set_vector_store(None)
    bad_settings = Settings(
        environment="test",
        host="127.0.0.1",
        port=8001,
        rag_index_path=tmp_path / "non_existent.json",
        ai_service_token=SecretStr("token"),
        gemini_api_key=SecretStr("key"),
    )

    app = create_app(settings=bad_settings)
    app.dependency_overrides[get_settings] = lambda: bad_settings

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as bad_client:
        # Live probe MUST still succeed independently of index state
        live_res = await bad_client.get("/health/live")
        assert live_res.status_code == 200
        assert live_res.json() == {"status": "ok"}

        # Ready probe MUST report 503 with status "not_ready"
        ready_res = await bad_client.get("/health/ready")
        assert ready_res.status_code == 503
        data = ready_res.json()
        assert data["status"] == "not_ready"
        assert data["index_loaded"] is False
        assert data["index_records"] == 0
        # Security: No stack trace or path exposure
        assert "non_existent.json" not in ready_res.text


@pytest.mark.asyncio
async def test_health_endpoints_require_no_auth(client: AsyncClient) -> None:
    # Explicitly test that unauthenticated requests to /health/* succeed
    live_res = await client.get("/health/live")
    assert live_res.status_code == 200

    ready_res = await client.get("/health/ready")
    assert ready_res.status_code == 200
