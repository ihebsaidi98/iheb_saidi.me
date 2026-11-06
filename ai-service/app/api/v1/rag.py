"""API router for RAG search and chat endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.safe_errors import (
    PUBLIC_GENERATION_FAILED,
    PUBLIC_RAG_CHAT_FAILED,
    PUBLIC_RAG_RETRIEVAL_FAILED,
    PUBLIC_SERVICE_UNAVAILABLE,
    log_route_error,
)
from app.dependencies import get_rag_service
from app.rag.schemas import (
    ChatRequest,
    ChatResponse,
    SearchRequest,
    SearchResponse,
)
from app.rag.service import (
    RAGConfigurationError,
    RAGGenerationError,
    RAGService,
)

logger = logging.getLogger("ai_service.api.v1.rag")

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post(
    "/search",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Semantic Vector Search",
    description="Search the portfolio knowledge base using cosine similarity over precomputed embeddings.",
)
async def search_portfolio(
    request: SearchRequest,
    service: Annotated[RAGService, Depends(get_rag_service)],
) -> SearchResponse:
    """Embed query, calculate cosine similarities, and return relevant portfolio chunks."""
    try:
        return await service.search(
            query=request.query,
            limit=request.limit,
            threshold=request.threshold,
        )
    except RAGConfigurationError as exc:
        log_route_error(logger, "RAG search configuration error", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SERVICE_UNAVAILABLE",
                "message": PUBLIC_SERVICE_UNAVAILABLE,
            },
        ) from exc
    except Exception as exc:
        log_route_error(logger, "RAG search failed unexpectedly", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "RETRIEVAL_ERROR",
                "message": PUBLIC_RAG_RETRIEVAL_FAILED,
            },
        ) from exc


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Grounded Portfolio Chat",
    description="Generate grounded chatbot answer strictly from retrieved portfolio chunks, matching the Next.js contract.",
)
async def chat_portfolio(
    request: ChatRequest,
    service: Annotated[RAGService, Depends(get_rag_service)],
) -> ChatResponse:
    """Retrieve relevant context and generate a safe, grounded reply with deduplicated sources."""
    try:
        return await service.chat(
            message=request.message,
            limit=request.limit,
            threshold=request.threshold,
            history=request.history,
        )
    except RAGConfigurationError as exc:
        log_route_error(logger, "RAG chat configuration error", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SERVICE_UNAVAILABLE",
                "message": PUBLIC_SERVICE_UNAVAILABLE,
            },
        ) from exc
    except RAGGenerationError as exc:
        log_route_error(logger, "RAG chat generation error", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "GENERATION_ERROR",
                "message": PUBLIC_GENERATION_FAILED,
            },
        ) from exc
    except Exception as exc:
        log_route_error(logger, "RAG chat failed unexpectedly", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "LLM_ERROR",
                "message": PUBLIC_RAG_CHAT_FAILED,
            },
        ) from exc
