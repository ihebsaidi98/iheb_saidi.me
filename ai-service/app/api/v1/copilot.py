"""API router for Career Copilot endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.copilot.schemas import (
    JobMatchAnalysisRequest,
    JobMatchAnalysisResponse,
    ProjectDeepDiveRequest,
    ProjectDeepDiveResponse,
)
from app.copilot.service import CareerCopilotService
from app.core.safe_errors import log_route_error
from app.dependencies import get_career_copilot_service

logger = logging.getLogger("ai_service.api.v1.copilot")

router = APIRouter(prefix="/copilot", tags=["Career Copilot"])


@router.post(
    "/match-job",
    response_model=JobMatchAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Match Job Description",
    description="Analyze job description alignment against Iheb's portfolio skills and project achievements.",
)
async def match_job_description(
    request: JobMatchAnalysisRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    copilot_service: Annotated[
        CareerCopilotService, Depends(get_career_copilot_service)
    ],
) -> JobMatchAnalysisResponse:
    """Analyze target job description and return detailed skill alignment and gap report."""
    if not settings.career_copilot_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "CAREER_COPILOT_DISABLED",
                "message": "Career Copilot capability is currently disabled by configuration.",
            },
        )

    try:
        return await copilot_service.match_job(request)
    except Exception as exc:
        log_route_error(logger, "Job match analysis failed unexpectedly", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "COPILOT_ERROR",
                "message": "Failed to analyze job description match.",
            },
        ) from exc


@router.post(
    "/project-deep-dive",
    response_model=ProjectDeepDiveResponse,
    status_code=status.HTTP_200_OK,
    summary="Project Deep Dive",
    description="Extract architectural highlights, technologies, and impact metrics for a specific project.",
)
async def project_deep_dive(
    request: ProjectDeepDiveRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    copilot_service: Annotated[
        CareerCopilotService, Depends(get_career_copilot_service)
    ],
) -> ProjectDeepDiveResponse:
    """Extract and synthesize technical details for a specific project."""
    if not settings.career_copilot_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "CAREER_COPILOT_DISABLED",
                "message": "Career Copilot capability is currently disabled by configuration.",
            },
        )

    try:
        return await copilot_service.deep_dive_project(request)
    except Exception as exc:
        log_route_error(logger, "Project deep dive failed unexpectedly", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "COPILOT_ERROR",
                "message": "Failed to perform project deep dive.",
            },
        ) from exc
