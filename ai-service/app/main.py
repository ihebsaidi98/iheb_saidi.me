"""FastAPI application factory and entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1.router import v1_router
from app.config import Settings, get_settings
from app.core.safe_errors import register_secret
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security import (
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai_service")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager for startup and shutdown validation."""
    settings = app.state.settings

    logger.info(
        "Starting Portfolio AI Service [env=%s, host=%s:%d, timeout=%.1fs]",
        settings.environment,
        settings.host,
        settings.port,
        settings.request_timeout_seconds,
    )

    # Startup validation
    if settings.is_production():
        token = settings.ai_service_token.get_secret_value()
        api_key = settings.gemini_api_key.get_secret_value()

        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is missing in production configuration.")

        if (
            not token
            or token == "dev-internal-token-change-in-production"
            or len(token) < 32
        ):
            raise RuntimeError(
                "A strong AI_SERVICE_TOKEN must be configured in production."
            )

    # Hydrate and validate the vector store at startup
    try:
        from app.dependencies import get_vector_store

        store = get_vector_store(settings)
        logger.info(
            "Knowledge base vector index hydrated (%d records, model=%s, dim=%d)",
            store.count,
            store.model,
            store.dimensions,
        )
    except Exception as exc:
        logger.error(
            "Failed to hydrate vector store at startup [%s]",
            type(exc).__name__,
        )
        if settings.is_production():
            raise RuntimeError(
                "FATAL: Vector store failed to initialize in production."
            ) from exc

    yield

    logger.info("Portfolio AI Service shutdown complete.")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure FastAPI application instance."""
    app_settings = settings or get_settings()

    app = FastAPI(
        title="Portfolio AI Service",
        description="Unified Python AI Service for Agentic RAG, Career Copilot, and Interview Simulator",
        version="0.1.0",
        docs_url="/docs" if not app_settings.is_production() else None,
        redoc_url=None,
        openapi_url="/openapi.json" if not app_settings.is_production() else None,
        lifespan=lifespan,
    )
    app.state.settings = app_settings

    # Register sensitive secrets for server-side log/exception redaction
    if app_settings.gemini_api_key:
        api_key_str = app_settings.gemini_api_key.get_secret_value()
        if api_key_str:
            register_secret(api_key_str)
    if app_settings.ai_service_token:
        token_str = app_settings.ai_service_token.get_secret_value()
        if token_str:
            register_secret(token_str)

    # Register structured error handling
    register_exception_handlers(app)

    # Add middlewares (executed in reverse order of addition in Starlette)
    # Layer 4 (Innermost, wraps application router): Payload size limit enforcement
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_size_bytes=app_settings.max_request_size_bytes,
    )

    # Layer 3: Standard security headers on all responses
    app.add_middleware(SecurityHeadersMiddleware)

    # Layer 2: CORS middleware (handles preflight OPTIONS and attaches CORS headers to all responses, including 413s)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Internal-Token",
            "X-Request-ID",
        ],
        max_age=600,
    )

    # Layer 1 (Outermost, first on ingress / last on egress): Request ID correlation
    app.add_middleware(RequestIdMiddleware)

    app.include_router(health_router)
    app.include_router(v1_router)

    return app


app = create_app()
