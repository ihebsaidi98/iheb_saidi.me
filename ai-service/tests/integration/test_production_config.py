"""Integration tests for production startup validation and configuration guards.

These tests verify that misconfigured production deployments fail fast and loudly
at startup rather than silently accepting insecure defaults.
"""

import contextlib

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr, ValidationError

from app.config import Settings
from app.main import create_app, lifespan

# ---------------------------------------------------------------------------
# Config-level validators (no app instantiation needed)
# ---------------------------------------------------------------------------


def test_wildcard_in_allowed_origins_raises_validation_error() -> None:
    """Wildcard '*' in allowed_origins must fail at settings-parse time."""
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins=["*"],  # type: ignore[arg-type]
        )


def test_wildcard_alone_raises_validation_error() -> None:
    """A list containing only '*' must also be rejected."""
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins="*",  # type: ignore[arg-type]
        )


def test_mixed_wildcard_and_explicit_raises_validation_error() -> None:
    """'*' mixed with explicit origins must also be rejected."""
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins=["http://localhost:3000", "*"],  # type: ignore[arg-type]
        )


def test_explicit_origins_accepted() -> None:
    """Explicit non-wildcard origin list must be accepted without error."""
    s = Settings(
        environment="test",
        allowed_origins=["http://localhost:3000", "https://portfolio.dev"],  # type: ignore[arg-type]
        ai_service_token=SecretStr("a-strong-test-token-at-least-32chars"),
    )
    assert "http://localhost:3000" in s.allowed_origins
    assert "https://portfolio.dev" in s.allowed_origins


# ---------------------------------------------------------------------------
# Production startup: lifespan directly tested
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_production_startup_fails_without_gemini_api_key() -> None:
    """Lifespan must raise RuntimeError when GEMINI_API_KEY is empty in production."""
    prod_settings = Settings(
        environment="production",
        ai_service_token=SecretStr("a-strong-production-token-with-enough-chars"),
        gemini_api_key=SecretStr(""),
        allowed_origins=["https://portfolio.dev"],  # type: ignore[arg-type]
    )
    app = create_app(settings=prod_settings)

    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        async with lifespan(app):
            pass


@pytest.mark.asyncio
async def test_production_startup_fails_with_default_token() -> None:
    """Default dev token must cause RuntimeError on production startup."""
    prod_settings = Settings(
        environment="production",
        ai_service_token=SecretStr("dev-internal-token-change-in-production"),
        gemini_api_key=SecretStr("AIzaSy-SENTINEL-GEMINI-KEY"),
        allowed_origins=["https://portfolio.dev"],  # type: ignore[arg-type]
    )
    app = create_app(settings=prod_settings)

    with pytest.raises(RuntimeError, match="strong AI_SERVICE_TOKEN"):
        async with lifespan(app):
            pass


@pytest.mark.asyncio
async def test_production_startup_fails_with_short_token() -> None:
    """A token shorter than 32 characters must cause RuntimeError on production startup."""
    prod_settings = Settings(
        environment="production",
        ai_service_token=SecretStr("short"),
        gemini_api_key=SecretStr("AIzaSy-SENTINEL-GEMINI-KEY"),
        allowed_origins=["https://portfolio.dev"],  # type: ignore[arg-type]
    )
    app = create_app(settings=prod_settings)

    with pytest.raises(RuntimeError, match="strong AI_SERVICE_TOKEN"):
        async with lifespan(app):
            pass


# ---------------------------------------------------------------------------
# Documentation routes unavailable in production
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_docs_url_disabled_in_production() -> None:
    """GET /docs must return 404 in production (docs_url=None)."""
    prod_settings = Settings(
        environment="production",
        ai_service_token=SecretStr("a-strong-production-token-with-enough-chars"),
        gemini_api_key=SecretStr("AIzaSy-SENTINEL-GEMINI-KEY"),
        allowed_origins=["https://portfolio.dev"],  # type: ignore[arg-type]
    )
    # Bypass lifespan to avoid startup failures unrelated to docs routing
    app = create_app(settings=prod_settings)
    app.router.lifespan_context = _null_lifespan  # type: ignore[attr-defined]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get("/docs")
        assert response.status_code == 404

        response = await c.get("/openapi.json")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_docs_url_disabled_in_staging() -> None:
    """GET /docs must return 404 in staging (docs_url=None)."""
    staging_settings = Settings(
        environment="staging",
        ai_service_token=SecretStr("a-strong-staging-token-with-enough-chars"),
        gemini_api_key=SecretStr("AIzaSy-SENTINEL-GEMINI-KEY"),
        allowed_origins=["https://staging.portfolio.dev"],  # type: ignore[arg-type]
    )
    app = create_app(settings=staging_settings)
    app.router.lifespan_context = _null_lifespan  # type: ignore[attr-defined]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get("/docs")
        assert response.status_code == 404

        response = await c.get("/openapi.json")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_staging_startup_fails_with_default_token() -> None:
    """Default dev token must cause RuntimeError on staging startup."""
    staging_settings = Settings(
        environment="staging",
        ai_service_token=SecretStr("dev-internal-token-change-in-production"),
        gemini_api_key=SecretStr("AIzaSy-SENTINEL-GEMINI-KEY"),
        allowed_origins=["https://staging.portfolio.dev"],  # type: ignore[arg-type]
    )
    app = create_app(settings=staging_settings)

    with pytest.raises(RuntimeError, match="strong AI_SERVICE_TOKEN"):
        async with lifespan(app):
            pass


@pytest.mark.asyncio
async def test_docs_url_available_in_development() -> None:
    """GET /openapi.json must return 200 in development (openapi_url='/openapi.json')."""
    dev_settings = Settings(
        environment="development",
        ai_service_token=SecretStr("a-strong-development-token-with-enough-chars"),
        gemini_api_key=SecretStr("AIzaSy-SENTINEL-GEMINI-KEY"),
        allowed_origins=["http://localhost:3000"],  # type: ignore[arg-type]
    )
    app = create_app(settings=dev_settings)
    app.router.lifespan_context = _null_lifespan  # type: ignore[attr-defined]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get("/openapi.json")
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@contextlib.asynccontextmanager
async def _null_lifespan(app):
    """Replace app lifespan with a no-op to skip startup checks in isolation tests."""
    yield
