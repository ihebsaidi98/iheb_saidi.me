"""Shared Pytest fixtures and mock configurations."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.config import Settings, get_settings
from app.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    """Provide isolated test settings."""
    return Settings(
        environment="test",
        host="127.0.0.1",
        port=8000,
        ai_service_token=SecretStr("valid-test-internal-token"),
        gemini_api_key=SecretStr("mock-test-gemini-key"),
        gemini_chat_model="gemini-3.5-flash-lite",
        gemini_embedding_model="gemini-embedding-001",
        max_request_size_bytes=1024,  # Small limit for testing 413s
        request_timeout_seconds=5.0,
    )


@pytest.fixture
async def client(test_settings: Settings) -> AsyncIterator[AsyncClient]:
    """Provide AsyncClient wired to the FastAPI application with test settings."""
    app = create_app(settings=test_settings)

    # Override get_settings dependency in FastAPI app
    app.dependency_overrides[get_settings] = lambda: test_settings

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client
