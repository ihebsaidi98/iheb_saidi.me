"""Health check endpoints for container and service orchestration."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.dependencies import get_vector_store_status

router = APIRouter(prefix="/health", tags=["Health"])


class LivenessResponse(BaseModel):
    status: str = "ok"


class ReadinessResponse(BaseModel):
    status: str
    service: str = "portfolio-ai-service"
    version: str = "0.1.0"
    environment: str
    gemini_configured: bool
    index_loaded: bool
    index_records: int


@router.get(
    "/live",
    response_model=LivenessResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
    description="Returns 200 OK if the application process is running.",
)
async def liveness() -> LivenessResponse:
    """Liveness probe for process supervision."""
    return LivenessResponse(status="ok")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    summary="Readiness Probe",
    description="Returns 200 OK when ready to accept traffic, or 503 if dependencies are not ready.",
)
async def readiness(
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReadinessResponse:
    """Readiness probe checking configuration validity and vector index hydration."""
    has_api_key = bool(settings.gemini_api_key.get_secret_value())
    is_loaded, record_count, _err = get_vector_store_status(settings)

    is_ready = is_loaded and (not settings.is_production() or has_api_key)

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        status="ready" if is_ready else "not_ready",
        service="portfolio-ai-service",
        version="0.1.0",
        environment=settings.environment,
        gemini_configured=has_api_key,
        index_loaded=is_loaded,
        index_records=record_count,
    )
