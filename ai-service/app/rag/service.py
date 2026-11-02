"""Orchestration service for RAG vector search and grounded chat."""

import asyncio
import logging
from typing import Any

from google.genai import types

from app.config import Settings
from app.core.safe_errors import redact_secrets
from app.rag.embedder import EmbedderError, embed_query
from app.rag.grounding import (
    INSUFFICIENT_EVIDENCE_REPLY,
    SYSTEM_PROMPT,
    build_gemini_chat_contents,
    clean_chat_response,
    deduplicate_sources,
)
from app.rag.retriever import retrieve_relevant_chunks
from app.rag.schemas import (
    ChatMessage,
    ChatResponse,
    SearchResponse,
    SearchResultItem,
)
from app.rag.store import PortfolioVectorStore

logger = logging.getLogger("ai_service.rag.service")

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
]


class RAGError(Exception):
    """Base exception for RAG service failures."""


class RAGConfigurationError(RAGError):
    """Raised when the service is missing required API keys or configuration."""


class RAGGenerationError(RAGError):
    """Raised when LLM text generation fails."""


def _is_retryable_model_error(err: Exception) -> bool:
    """Check if model failure should trigger candidate model fallback.

    Permanent client errors (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden)
    must NEVER trigger fallback.
    Only retryable errors (404 model not found, 429 rate limit, 500/503 service unavailable)
    should trigger fallback to another candidate model.
    """
    # Check status code attributes if present on SDK exceptions
    status_code = getattr(err, "status_code", None) or getattr(err, "code", None)
    if isinstance(status_code, int):
        if status_code in (400, 401, 403):
            return False
        if status_code in (404, 429, 500, 502, 503, 504):
            return True

    msg = str(err).lower()

    # Permanent failure keywords that must never trigger fallback
    permanent_indicators = [
        "api_key_invalid",
        "permission_denied",
        "invalid_argument",
        "unauthenticated",
        "401 unauthorized",
        "403 forbidden",
        "400 bad request",
    ]
    if any(ind in msg for ind in permanent_indicators):
        return False

    # Retryable failure keywords
    retryable_indicators = [
        "404",
        "not_found",
        "no longer available",
        "429",
        "resource_exhausted",
        "503",
        "unavailable",
        "high demand",
        "500",
        "internal",
        "overloaded",
        "deadline_exceeded",
        "504",
    ]
    return any(ind in msg for ind in retryable_indicators)


def extract_gemini_response_text(response: Any) -> str:
    """Extract and validate text from a Gemini GenerateContentResponse."""
    if response is None:
        raise RAGGenerationError("Gemini returned None response.")

    text = getattr(response, "text", None)
    if callable(text):
        text = text()
    if isinstance(text, str) and text.strip():
        return text.strip()

    # Inspect candidates structure
    candidates = getattr(response, "candidates", None)
    if isinstance(candidates, list) and len(candidates) > 0:
        content = getattr(candidates[0], "content", None)
        parts = getattr(content, "parts", None)
        if isinstance(parts, list):
            combined = "".join(str(getattr(p, "text", "") or "") for p in parts).strip()
            if combined:
                return combined

    raise RAGGenerationError("Gemini returned an empty or missing response.")


class RAGService:
    """High-level service coordinating vector search and grounded chat generation."""

    def __init__(
        self,
        store: PortfolioVectorStore,
        settings: Settings,
        gemini_client: Any = None,
    ) -> None:
        self.store = store
        self.settings = settings
        self.gemini_client = gemini_client

    async def search(
        self,
        query: str,
        limit: int | None = None,
        threshold: float | None = None,
    ) -> SearchResponse:
        """Search the portfolio vector store with query embedding and thresholding."""
        effective_limit = min(
            limit or self.settings.default_search_limit,
            self.settings.max_search_limit,
        )
        effective_threshold = (
            threshold
            if threshold is not None
            else self.settings.default_search_threshold
        )

        try:
            query_vector = await asyncio.to_thread(
                embed_query, query, self.gemini_client, self.settings
            )
        except EmbedderError as err:
            logger.error(
                "Embedding generation failed for search [%s]: %s",
                type(err).__name__,
                redact_secrets(str(err)),
            )
            raise RAGConfigurationError("Embedding service is unavailable.") from err

        results: list[SearchResultItem] = await asyncio.to_thread(
            retrieve_relevant_chunks,
            query_vector,
            self.store,
            limit=effective_limit,
            threshold=effective_threshold,
        )

        return SearchResponse(
            query=query,
            results=results,
            total=len(results),
            index_version=self.store.kb_version,
        )

    async def chat(
        self,
        message: str,
        limit: int | None = None,
        threshold: float | None = None,
        history: list[ChatMessage] | None = None,
    ) -> ChatResponse:
        """Answer user message using grounded context or fallback safely."""
        search_res = await self.search(
            query=message,
            limit=limit,
            threshold=threshold,
        )

        # If no relevant chunks found meeting threshold, do not call LLM
        if not search_res.results:
            effective_threshold = (
                threshold
                if threshold is not None
                else self.settings.default_search_threshold
            )
            logger.info(
                "No matching chunks above threshold (results=0, threshold=%.2f)",
                effective_threshold,
            )
            return ChatResponse(
                reply=INSUFFICIENT_EVIDENCE_REPLY,
                sources=[],
            )

        sources = deduplicate_sources(search_res.results)
        contents = build_gemini_chat_contents(
            question=message,
            chunks=search_res.results,
            history=history or [],
        )

        reply_text = await self._generate_grounded_reply(contents)
        clean_reply = clean_chat_response(reply_text)
        return ChatResponse(reply=clean_reply, sources=sources)

    async def _generate_grounded_reply(self, contents: list[types.Content]) -> str:
        """Call Gemini chat generation with candidate model fallback and timeouts."""
        if self.gemini_client is None:
            raise RAGConfigurationError("Gemini client is not configured.")

        candidates: list[str] = []
        for model_name in [self.settings.gemini_chat_model, *FALLBACK_MODELS]:
            if model_name and model_name not in candidates:
                candidates.append(model_name)

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
            max_output_tokens=600,
        )

        last_error: Exception | None = None

        for candidate in candidates:
            try:
                logger.debug("Attempting chat generation with model: %s", candidate)

                def _call_model(target_model: str = candidate) -> Any:
                    return self.gemini_client.models.generate_content(
                        model=target_model,
                        contents=contents,
                        config=config,
                    )

                response = await asyncio.wait_for(
                    asyncio.to_thread(_call_model),
                    timeout=self.settings.request_timeout_seconds,
                )

                if candidate != self.settings.gemini_chat_model:
                    logger.warning("Fallback model %s succeeded for chat.", candidate)

                return extract_gemini_response_text(response)

            except TimeoutError as err:
                logger.error("Chat generation timed out for model %s", candidate)
                raise RAGGenerationError(
                    "Request timed out during generation."
                ) from err
            except Exception as err:
                last_error = err
                safe_err = redact_secrets(str(err))
                if not _is_retryable_model_error(err):
                    logger.error(
                        "Non-retryable error with model %s: %s", candidate, safe_err
                    )
                    raise RAGGenerationError("Model generation failed.") from err

                logger.warning(
                    "Model %s failed with retryable error (%s). Trying next fallback...",
                    candidate,
                    safe_err,
                )

        if last_error is not None:
            logger.error(
                "All candidate chat models failed; last error [%s]: %s",
                type(last_error).__name__,
                redact_secrets(str(last_error)),
            )
        raise RAGGenerationError("All candidate chat models failed.")
