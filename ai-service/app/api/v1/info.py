"""Internal info endpoint for service metadata and capabilities."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.config import Settings, get_settings

router = APIRouter(tags=["Internal V1"])


class ServiceInfoResponse(BaseModel):
    service: str = "portfolio-ai-service"
    version: str = "0.1.0"
    phase: int = 1
    environment: str
    active_chat_model: str
    active_embedding_model: str
    capabilities: list[str]


@router.get(
    "/info",
    response_model=ServiceInfoResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Information",
    description="Internal endpoint returning capabilities and platform state.",
)
async def get_service_info(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ServiceInfoResponse:
    """Return internal service capabilities and metadata."""
    return ServiceInfoResponse(
        environment=settings.environment,
        active_chat_model=settings.gemini_chat_model,
        active_embedding_model=settings.gemini_embedding_model,
        capabilities=[
            "health_probes",
            "internal_token_auth",
            "request_id_correlation",
            "payload_size_limits",
            "structured_errors",
            "bounded_retries",
        ],
    )
