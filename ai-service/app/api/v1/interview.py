"""API router for Mixed-Format Interview Simulator endpoints."""

import ipaddress
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.core.safe_errors import log_route_error
from app.dependencies import get_interview_service
from app.interview.schemas import (
    CompleteSessionRequest,
    SessionCompletionReport,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerAck,
    SubmitAnswerRequest,
)
from app.interview.service import InterviewSimulatorService

logger = logging.getLogger("ai_service.api.v1.interview")

router = APIRouter(prefix="/interview", tags=["Mixed-Format Interview Simulator"])

MAX_CLIENT_IP_KEY_LENGTH = 45


def _validate_client_ip_key(raw: str) -> str:
    """Validate the server-injected client IP key as an IPv4/IPv6 literal.

    The value is only a session-limiting key, never an identity or an
    authorization input. It is rejected unless it is a bare IP literal.
    """
    value = raw.strip()
    if not value or len(value) > MAX_CLIENT_IP_KEY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INVALID_CLIENT_IP_KEY",
                "message": "X-Client-IP-Key must be a valid IP address.",
            },
        )
    try:
        ipaddress.ip_address(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INVALID_CLIENT_IP_KEY",
                "message": "X-Client-IP-Key must be a valid IP address.",
            },
        ) from exc
    return value


@router.post(
    "/start",
    response_model=StartInterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Interview Session",
    description="Initialize a 10-question mixed-format interview session with session token.",
)
async def start_interview(
    request: StartInterviewRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    interview_service: Annotated[
        InterviewSimulatorService, Depends(get_interview_service)
    ],
    x_client_ip_key: Annotated[str, Header(alias="X-Client-IP-Key")],
) -> StartInterviewResponse:
    """Start 10-question interview session with track configuration."""
    client_ip_key = _validate_client_ip_key(x_client_ip_key)

    if not settings.interview_simulator_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "INTERVIEW_SIMULATOR_DISABLED",
                "message": "Interview Simulator capability is currently disabled by configuration.",
            },
        )

    try:
        return await interview_service.start_interview(
            request, client_ip_key=client_ip_key
        )
    except HTTPException:
        raise
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
    response_model=SubmitAnswerAck,
    status_code=status.HTTP_200_OK,
    summary="Submit Interview Answer",
    description="Submit candidate response blindly without scoring feedback until session completion.",
)
async def submit_answer(
    request: SubmitAnswerRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    interview_service: Annotated[
        InterviewSimulatorService, Depends(get_interview_service)
    ],
) -> SubmitAnswerAck:
    """Submit candidate response blindly."""
    if not settings.interview_simulator_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "INTERVIEW_SIMULATOR_DISABLED",
                "message": "Interview Simulator capability is currently disabled by configuration.",
            },
        )

    try:
        return await interview_service.submit_answer(request)
    except HTTPException:
        raise
    except Exception as exc:
        log_route_error(logger, "Failed to submit interview answer", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "INTERVIEW_ERROR",
                "message": "Failed to submit interview answer.",
            },
        ) from exc


@router.post(
    "/complete",
    response_model=SessionCompletionReport,
    status_code=status.HTTP_200_OK,
    summary="Complete Interview Session",
    description="Evaluate completed interview session, compute score out of 100, and return full report.",
)
async def complete_session(
    request: CompleteSessionRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    interview_service: Annotated[
        InterviewSimulatorService, Depends(get_interview_service)
    ],
) -> SessionCompletionReport:
    """Complete interview session and retrieve comprehensive report."""
    if not settings.interview_simulator_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "INTERVIEW_SIMULATOR_DISABLED",
                "message": "Interview Simulator capability is currently disabled by configuration.",
            },
        )

    try:
        return await interview_service.complete_session(request)
    except HTTPException:
        raise
    except Exception as exc:
        log_route_error(logger, "Failed to complete interview session", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "INTERVIEW_ERROR",
                "message": "Failed to complete interview session.",
            },
        ) from exc
