"""NumPy-based cosine similarity retrieval over in-memory portfolio vector store."""

import logging

import numpy as np

from app.rag.schemas import SearchResultItem
from app.rag.store import PortfolioVectorStore

logger = logging.getLogger("ai_service.rag.retriever")


class RetrievalError(Exception):
    """Raised when vector similarity computation fails."""


def retrieve_relevant_chunks(
    query_vector: np.ndarray,
    store: PortfolioVectorStore,
    limit: int = 5,
    threshold: float = 0.35,
) -> list[SearchResultItem]:
    """Perform vectorized cosine similarity search over stored portfolio chunks.

    Requires normalized query_vector and normalized store matrix.
    Applies score thresholding and deterministic sorting by (-score, record.id).
    """
    if store.count == 0:
        return []

    if query_vector.ndim != 1 or query_vector.shape[0] != store.dimensions:
        raise RetrievalError(
            f"Query vector dimension mismatch: expected ({store.dimensions},), got {query_vector.shape}."
        )

    # Compute dot products with all normalized chunk vectors
    scores = np.dot(store.normalized_matrix, query_vector)

    if not np.all(np.isfinite(scores)):
        raise RetrievalError("Computed similarity scores contain non-finite values.")

    # Find candidates meeting minimum threshold
    matching_indices = np.where(scores >= threshold)[0]
    if len(matching_indices) == 0:
        return []

    # Sort deterministically: highest score first, then record ID alphabetically
    candidates = [
        (float(scores[idx]), store.records[idx].id, idx) for idx in matching_indices
    ]
    candidates.sort(key=lambda item: (-item[0], item[1]))

    selected = candidates[:limit]

    results: list[SearchResultItem] = []
    for score, _rec_id, idx in selected:
        rec = store.records[idx]
        results.append(
            SearchResultItem(
                id=rec.id,
                documentId=rec.document_id,
                source=rec.source,
                type=rec.type,
                title=rec.title,
                summary=rec.summary,
                text=rec.text,
                score=round(score, 5),
                tags=list(rec.tags),
                metadata=rec.metadata,
            )
        )

    return results
