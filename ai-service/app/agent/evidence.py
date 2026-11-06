"""Evidence merging, deduplication, and sufficiency evaluation for Agentic RAG."""

import logging

from app.rag.schemas import SearchResultItem

logger = logging.getLogger("ai_service.agent.evidence")


def merge_and_rank_chunks(
    chunks_by_query: list[list[SearchResultItem]],
    max_chunks: int = 10,
) -> list[SearchResultItem]:
    """Merge retrieved chunks from multiple subqueries, deduplicate by chunk ID, and rank deterministically.

    If a chunk appears in multiple subquery results, its highest score is retained.
    """
    seen: dict[str, SearchResultItem] = {}

    for query_results in chunks_by_query:
        for chunk in query_results:
            if chunk.id not in seen:
                seen[chunk.id] = chunk
            else:
                # Retain the chunk with the higher similarity score
                if chunk.score > seen[chunk.id].score:
                    seen[chunk.id] = chunk

    merged = list(seen.values())
    # Deterministic sorting: score descending, then chunk id ascending
    merged.sort(key=lambda c: (-c.score, c.id))

    return merged[:max_chunks]


def evaluate_evidence_sufficiency(
    chunks: list[SearchResultItem],
    threshold: float = 0.35,
) -> bool:
    """Evaluate whether the retrieved evidence pool is sufficient to answer the query safely."""
    if not chunks:
        logger.info("Evidence check failed: zero chunks retrieved.")
        return False

    best_score = max(c.score for c in chunks)
    if best_score < threshold:
        logger.info(
            "Evidence check failed: best score %.4f below threshold %.4f.",
            best_score,
            threshold,
        )
        return False

    return True
