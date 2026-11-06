"""Unit tests for evidence merging, ranking, and sufficiency evaluation."""

from app.agent.evidence import evaluate_evidence_sufficiency, merge_and_rank_chunks
from app.rag.schemas import SearchResultItem


def _make_chunk(chunk_id: str, score: float, title: str = "Doc") -> SearchResultItem:
    return SearchResultItem(
        id=chunk_id,
        documentId=f"doc-{chunk_id}",
        source="portfolio",
        type="experience",
        title=title,
        summary=f"Summary for {chunk_id}",
        text=f"Content for {chunk_id}",
        score=score,
    )


def test_merge_and_rank_chunks_empty() -> None:
    """Empty subquery lists should return empty list."""
    assert merge_and_rank_chunks([]) == []
    assert merge_and_rank_chunks([[], []]) == []


def test_merge_and_rank_chunks_deduplication_keeps_highest_score() -> None:
    """When a chunk is retrieved across multiple subqueries, keep the highest score."""
    q1 = [_make_chunk("c1", 0.5), _make_chunk("c2", 0.6)]
    q2 = [_make_chunk("c1", 0.8), _make_chunk("c3", 0.4)]

    merged = merge_and_rank_chunks([q1, q2], max_chunks=10)
    assert len(merged) == 3
    # c1 should have score 0.8 and be top ranked
    assert merged[0].id == "c1"
    assert merged[0].score == 0.8
    assert merged[1].id == "c2"
    assert merged[1].score == 0.6
    assert merged[2].id == "c3"
    assert merged[2].score == 0.4


def test_merge_and_rank_chunks_deterministic_tie_breaking() -> None:
    """Equal scores should be broken deterministically by chunk id ascending."""
    q1 = [_make_chunk("chunk-z", 0.7), _make_chunk("chunk-a", 0.7)]
    merged = merge_and_rank_chunks([q1], max_chunks=10)
    assert len(merged) == 2
    assert merged[0].id == "chunk-a"
    assert merged[1].id == "chunk-z"


def test_merge_and_rank_chunks_max_chunks_bound() -> None:
    """Chunks should be capped at max_chunks."""
    chunks = [_make_chunk(f"c{i}", 0.1 * i) for i in range(10)]
    merged = merge_and_rank_chunks([chunks], max_chunks=3)
    assert len(merged) == 3
    assert [c.id for c in merged] == ["c9", "c8", "c7"]


def test_evaluate_evidence_sufficiency_empty() -> None:
    """Empty chunk list is insufficient."""
    assert evaluate_evidence_sufficiency([]) is False


def test_evaluate_evidence_sufficiency_below_threshold() -> None:
    """Max score below threshold is insufficient."""
    chunks = [_make_chunk("c1", 0.20), _make_chunk("c2", 0.34)]
    assert evaluate_evidence_sufficiency(chunks, threshold=0.35) is False


def test_evaluate_evidence_sufficiency_above_threshold() -> None:
    """At least one chunk at or above threshold is sufficient."""
    chunks = [_make_chunk("c1", 0.20), _make_chunk("c2", 0.36)]
    assert evaluate_evidence_sufficiency(chunks, threshold=0.35) is True
