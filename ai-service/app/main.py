"""FastAPI application factory and entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1.router import v1_router
from app.config import Settings, get_settings
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
    settings = get_settings()
    logger.info(
        "Starting Portfolio AI Service [env=%s, host=%s:%d, timeout=%.1fs]",
        settings.environment,
        settings.host,
        settings.port,
        settings.request_timeout_seconds,
    )

    # Startup validation: Ensure required settings are non-empty
    if settings.is_production() and not settings.gemini_api_key.get_secret_value():
        logger.error("FATAL: GEMINI_API_KEY must be configured in production.")
        raise RuntimeError("GEMINI_API_KEY is missing in production configuration.")

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

    # Register structured error handling
    register_exception_handlers(app)

    # Add middlewares (executed in reverse order of addition)
    # 1. CORS Middleware (restrictive, based on allowed_origins)
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

    # 2. Security response headers (nosniff, DENY, etc.)
    app.add_middleware(SecurityHeadersMiddleware)

    # 3. Request body size limit
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_size_bytes=app_settings.max_request_size_bytes,
    )

    # 4. Request ID propagation
    app.add_middleware(RequestIdMiddleware)

    # Mount API routers
    app.include_router(health_router)
    app.include_router(v1_router)

    return app


app = create_app()
