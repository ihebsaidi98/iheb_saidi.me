"""Unit tests for retrieve_relevant_chunks with cosine similarity."""

import numpy as np
import pytest

from app.rag.retriever import RetrievalError, retrieve_relevant_chunks
from app.rag.store import PortfolioVectorStore, VectorRecord


@pytest.fixture
def sample_vector_store() -> PortfolioVectorStore:
    """Create a controlled 3-record store with orthogonal and identical unit vectors."""
    dim = 4
    # Three records:
    # r1: [1, 0, 0, 0]
    # r2: [0, 1, 0, 0]
    # r3: [1, 0, 0, 0] (tie with r1 for query [1,0,0,0], but id "chunk-b" vs "chunk-a")
    v1 = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    v2 = np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32)
    v3 = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)

    records = (
        VectorRecord(
            id="chunk-b",
            document_id="doc-b",
            source="test",
            type="profile",
            title="Chunk B",
            summary="Summary B",
            text="Text B",
        ),
        VectorRecord(
            id="chunk-c",
            document_id="doc-c",
            source="test",
            type="project",
            title="Chunk C",
            summary="Summary C",
            text="Text C",
        ),
        VectorRecord(
            id="chunk-a",
            document_id="doc-a",
            source="test",
            type="profile",
            title="Chunk A",
            summary="Summary A",
            text="Text A",
        ),
    )
    matrix = np.stack([v1, v2, v3], axis=0)

    return PortfolioVectorStore(
        records=records,
        normalized_matrix=matrix,
        model="gemini-embedding-001",
        dimensions=dim,
        version=1,
        kb_version="test",
        created_at="2026-01-01T00:00:00Z",
    )


def test_cosine_similarity_exact_match(sample_vector_store: PortfolioVectorStore):
    """Exact match query should yield score 1.0."""
    query = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    results = retrieve_relevant_chunks(
        query, sample_vector_store, limit=5, threshold=0.5
    )
    assert len(results) == 2
    assert results[0].score == 1.0
    assert results[1].score == 1.0


def test_deterministic_tie_breaking(sample_vector_store: PortfolioVectorStore):
    """When scores are identical, chunks should be ordered alphabetically by chunk id."""
    query = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    results = retrieve_relevant_chunks(
        query, sample_vector_store, limit=5, threshold=0.5
    )
    # "chunk-a" should precede "chunk-b"
    assert results[0].id == "chunk-a"
    assert results[1].id == "chunk-b"


def test_threshold_filtering(sample_vector_store: PortfolioVectorStore):
    """Orthogonal vector (similarity 0.0) should be excluded when threshold > 0."""
    query = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    # threshold 0.1 excludes chunk-c (score 0.0)
    results = retrieve_relevant_chunks(
        query, sample_vector_store, limit=5, threshold=0.1
    )
    ids = [r.id for r in results]
    assert "chunk-c" not in ids


def test_limit_truncation(sample_vector_store: PortfolioVectorStore):
    """Limit should truncate results even if multiple candidates exceed threshold."""
    query = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    results = retrieve_relevant_chunks(
        query, sample_vector_store, limit=1, threshold=0.1
    )
    assert len(results) == 1
    assert results[0].id == "chunk-a"


def test_dimension_mismatch_raises_retrieval_error(
    sample_vector_store: PortfolioVectorStore,
):
    """Dimension mismatch should raise RetrievalError."""
    wrong_dim_query = np.array([1.0, 0.0], dtype=np.float32)
    with pytest.raises(RetrievalError, match="Query vector dimension mismatch"):
        retrieve_relevant_chunks(wrong_dim_query, sample_vector_store)


def test_empty_store_returns_empty_list():
    """Empty vector store returns empty list gracefully."""
    empty_store = PortfolioVectorStore(
        records=(),
        normalized_matrix=np.empty((0, 4), dtype=np.float32),
        model="gemini-embedding-001",
        dimensions=4,
        version=1,
        kb_version="test",
        created_at="",
    )
    query = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    results = retrieve_relevant_chunks(query, empty_store)
    assert results == []
