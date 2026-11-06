"""FastAPI dependencies for security and settings."""

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.agent.orchestrator import AgenticRAGOrchestrator
from app.config import Settings, get_settings
from app.copilot.service import CareerCopilotService
from app.core.gemini_client import get_gemini_client
from app.interview.service import InterviewSimulatorService
from app.rag.service import RAGService
from app.rag.store import PortfolioVectorStore


async def verify_internal_token(
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,  # type: ignore[assignment]
) -> str:
    """Verify incoming internal server-to-server token in constant time.

    Accepts token via 'X-Internal-Token' header or 'Authorization: Bearer <token>'.
    Rejects unauthorized requests immediately.
    """
    token_to_check: str | None = None

    if x_internal_token:
        token_to_check = x_internal_token.strip()
    elif authorization and authorization.startswith("Bearer "):
        token_to_check = authorization[7:].strip()

    expected_token = settings.ai_service_token.get_secret_value()

    # Defence in depth: reject immediately if either side is empty.
    # secrets.compare_digest("", "") would return True — never allow that.
    if not token_to_check or not expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid or missing internal service authentication token.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not secrets.compare_digest(token_to_check, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid or missing internal service authentication token.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_to_check


_vector_store_instance: PortfolioVectorStore | None = None
_vector_store_error: str | None = None


def get_vector_store(
    settings: Annotated[Settings, Depends(get_settings)],
) -> PortfolioVectorStore:
    """Return singleton in-memory vector store loaded from precomputed index."""
    global _vector_store_instance, _vector_store_error
    if _vector_store_instance is not None:
        return _vector_store_instance

    try:
        _vector_store_instance = PortfolioVectorStore.from_file(
            file_path=settings.rag_index_path,
            expected_model=settings.gemini_embedding_model,
            expected_dimensions=settings.gemini_embedding_dimensions,
        )
        _vector_store_error = None
        return _vector_store_instance
    except Exception as err:
        _vector_store_error = type(err).__name__
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SERVICE_UNAVAILABLE",
                "message": "Knowledge base vector index is unavailable or corrupt.",
            },
        ) from err


def set_vector_store(store: PortfolioVectorStore | None) -> None:
    """Set or reset the vector store singleton (used in test fixtures)."""
    global _vector_store_instance, _vector_store_error
    _vector_store_instance = store
    _vector_store_error = None


def get_vector_store_status(
    settings: Settings,
) -> tuple[bool, int, str | None]:
    """Return (is_loaded, record_count, error_name) without raising."""
    global _vector_store_instance, _vector_store_error
    if _vector_store_instance is not None:
        return True, _vector_store_instance.count, None

    try:
        store = get_vector_store(settings)
        return True, store.count, None
    except Exception:
        return False, 0, _vector_store_error or "LoadFailed"


def get_rag_service(
    settings: Annotated[Settings, Depends(get_settings)],
    store: Annotated[PortfolioVectorStore, Depends(get_vector_store)],
) -> RAGService:
    """Return RAGService instance configured with active store and Gemini client."""
    client = get_gemini_client(settings)
    return RAGService(store=store, settings=settings, gemini_client=client)


def get_agent_orchestrator(
    settings: Annotated[Settings, Depends(get_settings)],
    rag_service: Annotated[RAGService, Depends(get_rag_service)],
) -> AgenticRAGOrchestrator:
    """Return AgenticRAGOrchestrator configured with RAGService and settings."""
    return AgenticRAGOrchestrator(rag_service=rag_service, settings=settings)


def get_career_copilot_service(
    settings: Annotated[Settings, Depends(get_settings)],
    store: Annotated[PortfolioVectorStore, Depends(get_vector_store)],
    rag_service: Annotated[RAGService, Depends(get_rag_service)],
) -> CareerCopilotService:
    """Return CareerCopilotService configured with store, RAG service, and settings."""
    client = get_gemini_client(settings)
    return CareerCopilotService(
        store=store,
        rag_service=rag_service,
        settings=settings,
        gemini_client=client,
    )


def get_interview_service(
    settings: Annotated[Settings, Depends(get_settings)],
    store: Annotated[PortfolioVectorStore, Depends(get_vector_store)],
) -> InterviewSimulatorService:
    """Return InterviewSimulatorService configured with store and settings."""
    client = get_gemini_client(settings)
    return InterviewSimulatorService(
        store=store,
        settings=settings,
        gemini_client=client,
    )
