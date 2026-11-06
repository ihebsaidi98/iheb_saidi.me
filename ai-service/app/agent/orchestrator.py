"""Bounded orchestrator for Agentic RAG."""

import logging
import time

from google.genai import types

from app.agent.decomposition import decompose_query
from app.agent.evidence import (
    evaluate_evidence_sufficiency,
    merge_and_rank_chunks,
)
from app.agent.router import route_intent
from app.agent.schemas import (
    AgentAnswerRequest,
    AgentAnswerResponse,
    AgentMetadata,
)
from app.config import Settings
from app.rag.grounding import (
    INSUFFICIENT_EVIDENCE_REPLY,
    deduplicate_sources,
    format_user_prompt,
)
from app.rag.schemas import SearchResultItem
from app.rag.service import RAGService

logger = logging.getLogger("ai_service.agent.orchestrator")


class AgenticRAGOrchestrator:
    """Orchestrator coordinating intent routing, query decomposition, and bounded retrieval."""

    def __init__(self, rag_service: RAGService, settings: Settings) -> None:
        self.rag_service = rag_service
        self.settings = settings

    async def answer(self, request: AgentAnswerRequest) -> AgentAnswerResponse:
        """Execute bounded Agentic RAG workflow and return grounded answer with metadata."""
        t0 = time.perf_counter()

        # 1. Intent routing
        intent = route_intent(
            request.message,
            client=self.rag_service.gemini_client,
            settings=self.settings,
        )

        # 2. Out-of-scope fast abstention
        if intent == "out_of_scope":
            logger.info(
                "Query routed to out_of_scope. Refusing safely without LLM call."
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return AgentAnswerResponse(
                reply=INSUFFICIENT_EVIDENCE_REPLY,
                sources=[],
                metadata=AgentMetadata(
                    intent="out_of_scope",
                    subqueries=[],
                    subqueries_count=0,
                    retrieval_count=0,
                    abstained=True,
                    execution_time_ms=round(elapsed_ms, 2),
                ),
            )

        # 3. Query decomposition
        if intent == "multi_part":
            max_subq = min(request.max_subqueries, self.settings.agent_max_subqueries)
            subqueries = decompose_query(
                request.message,
                max_subqueries=max_subq,
                client=self.rag_service.gemini_client,
            )
        else:
            subqueries = [request.message]

        # 4. Bounded iterative retrieval
        chunks_by_query: list[list[SearchResultItem]] = []
        retrieval_call_count = 0
        max_calls = self.settings.agent_max_retrieval_calls

        for subq in subqueries:
            if retrieval_call_count >= max_calls:
                logger.warning(
                    "Reached maximum retrieval call budget (%d calls).", max_calls
                )
                break

            search_res = await self.rag_service.search(
                query=subq,
                limit=request.retrieval_limit,
                threshold=request.threshold,
            )
            chunks_by_query.append(search_res.results)
            retrieval_call_count += 1

        # 5. Merge and rank evidence across subqueries
        merged_chunks = merge_and_rank_chunks(
            chunks_by_query,
            max_chunks=self.settings.agent_max_context_chunks,
        )

        # 6. Sufficiency evaluation
        is_sufficient = evaluate_evidence_sufficiency(
            merged_chunks,
            threshold=request.threshold,
        )

        if not is_sufficient:
            logger.info(
                "Insufficient evidence retrieved (chunks=%d, retrieval_calls=%d)",
                len(merged_chunks),
                retrieval_call_count,
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return AgentAnswerResponse(
                reply=INSUFFICIENT_EVIDENCE_REPLY,
                sources=[],
                metadata=AgentMetadata(
                    intent=intent,
                    subqueries=subqueries,
                    subqueries_count=len(subqueries),
                    retrieval_count=retrieval_call_count,
                    abstained=True,
                    execution_time_ms=round(elapsed_ms, 2),
                ),
            )

        # 7. Grounded chat generation
        sources = deduplicate_sources(merged_chunks)
        user_prompt = format_user_prompt(request.message, merged_chunks)

        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_prompt)],
            )
        ]

        reply_text = await self.rag_service._generate_grounded_reply(contents)

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return AgentAnswerResponse(
            reply=reply_text,
            sources=sources,
            metadata=AgentMetadata(
                intent=intent,
                subqueries=subqueries,
                subqueries_count=len(subqueries),
                retrieval_count=retrieval_call_count,
                abstained=False,
                execution_time_ms=round(elapsed_ms, 2),
            ),
        )
