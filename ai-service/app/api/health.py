"""Health check endpoints for container and service orchestration."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.config import Settings, get_settings

router = APIRouter(prefix="/health", tags=["Health"])


class LivenessResponse(BaseModel):
    status: str = "ok"


class ReadinessResponse(BaseModel):
    status: str = "ready"
    service: str
    version: str
    environment: str
    gemini_configured: bool


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
    description="Returns 200 OK with service state when ready to accept traffic.",
)
async def readiness(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReadinessResponse:
    """Readiness probe checking configuration validity."""
    has_api_key = bool(settings.gemini_api_key.get_secret_value())
    return ReadinessResponse(
        status="ready",
        service="portfolio-ai-service",
        version="0.1.0",
        environment=settings.environment,
        gemini_configured=has_api_key,
    )
