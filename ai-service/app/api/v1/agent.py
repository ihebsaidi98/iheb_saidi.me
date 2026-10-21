"""API router for Agentic RAG endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.agent.orchestrator import AgenticRAGOrchestrator
from app.agent.schemas import AgentAnswerRequest, AgentAnswerResponse
from app.config import Settings, get_settings
from app.core.safe_errors import (
    PUBLIC_AGENT_FAILED,
    PUBLIC_GENERATION_FAILED,
    PUBLIC_SERVICE_UNAVAILABLE,
    log_route_error,
)
from app.dependencies import get_agent_orchestrator
from app.rag.service import RAGConfigurationError, RAGGenerationError

logger = logging.getLogger("ai_service.api.v1.agent")

router = APIRouter(prefix="/agent", tags=["Agentic RAG"])


@router.post(
    "/answer",
    response_model=AgentAnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Agentic RAG Answer",
    description="Intelligent orchestration with intent routing, query decomposition, and evidence sufficiency evaluation.",
)
async def agent_answer(
    request: AgentAnswerRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    orchestrator: Annotated[AgenticRAGOrchestrator, Depends(get_agent_orchestrator)],
) -> AgentAnswerResponse:
    """Answer question using Agentic RAG workflow with bounded subqueries and evidence merging."""
    if not settings.agentic_rag_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "AGENTIC_RAG_DISABLED",
                "message": "Agentic RAG capability is currently disabled by configuration.",
            },
        )

    try:
        return await orchestrator.answer(request)
    except RAGConfigurationError as exc:
        log_route_error(logger, "Agentic RAG configuration error", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SERVICE_UNAVAILABLE",
                "message": PUBLIC_SERVICE_UNAVAILABLE,
            },
        ) from exc
    except RAGGenerationError as exc:
        log_route_error(logger, "Agentic RAG generation error", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "GENERATION_ERROR",
                "message": PUBLIC_GENERATION_FAILED,
            },
        ) from exc
    except Exception as exc:
        log_route_error(logger, "Agentic RAG execution failed unexpectedly", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "AGENT_ERROR",
                "message": PUBLIC_AGENT_FAILED,
            },
        ) from exc
