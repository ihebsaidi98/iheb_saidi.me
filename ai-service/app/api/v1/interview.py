"""API router for Adaptive Interview Simulator endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.core.safe_errors import log_route_error
from app.dependencies import get_interview_service
from app.interview.schemas import (
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.interview.service import InterviewSimulatorService

logger = logging.getLogger("ai_service.api.v1.interview")

router = APIRouter(prefix="/interview", tags=["Adaptive Interview Simulator"])


@router.post(
    "/start",
    response_model=StartInterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Interview Session",
    description="Initialize an adaptive technical interview session with an initial portfolio-grounded question.",
)
async def start_interview(
    request: StartInterviewRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    interview_service: Annotated[
        InterviewSimulatorService, Depends(get_interview_service)
    ],
) -> StartInterviewResponse:
    """Start adaptive interview session with track and difficulty configuration."""
    if not settings.interview_simulator_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "INTERVIEW_SIMULATOR_DISABLED",
                "message": "Adaptive Interview Simulator capability is currently disabled by configuration.",
            },
        )

    try:
        return await interview_service.start_interview(request)
    except Exception as exc:
        log_route_error(logger, "Failed to start interview session", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "INTERVIEW_ERROR",
                "message": "Failed to initialize interview session.",
            },
        ) from exc


@router.post(
    "/submit-answer",
    response_model=SubmitAnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Interview Answer",
    description="Evaluate technical response against a multi-criteria rubric and generate adaptive follow-up.",
)
async def submit_answer(
    request: SubmitAnswerRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    interview_service: Annotated[
        InterviewSimulatorService, Depends(get_interview_service)
    ],
) -> SubmitAnswerResponse:
    """Submit candidate response for rubric evaluation and adaptive next question."""
    if not settings.interview_simulator_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "INTERVIEW_SIMULATOR_DISABLED",
                "message": "Adaptive Interview Simulator capability is currently disabled by configuration.",
            },
        )

    try:
        return await interview_service.submit_answer(request)
    except Exception as exc:
        log_route_error(logger, "Failed to evaluate interview answer", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "INTERVIEW_ERROR",
                "message": "Failed to evaluate interview answer.",
            },
        ) from exc
