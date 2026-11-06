"""Unit tests for query decomposition logic."""

from app.agent.decomposition import decompose_query


def test_decompose_query_atomic_fallback() -> None:
    """Atomic queries should return a single subquery identical to the original."""
    query = "What is Iheb's experience with Java?"
    subqueries = decompose_query(query, max_subqueries=3)
    assert subqueries == [query]


def test_decompose_query_multiple_question_marks() -> None:
    """Queries with multiple questions separated by ? should be split."""
    query = "What did Iheb do at Novatek? What was his tech stack?"
    subqueries = decompose_query(query, max_subqueries=3)
    assert len(subqueries) == 2
    assert "Novatek" in subqueries[0]
    assert "tech stack" in subqueries[1]


def test_decompose_query_compare_x_and_y() -> None:
    """Compare X and Y queries should yield distinct subqueries for X and Y."""
    query = "Compare Iheb's backend experience and his AI projects"
    subqueries = decompose_query(query, max_subqueries=3)
    assert len(subqueries) == 2
    assert any("backend experience" in sq for sq in subqueries)
    assert any("AI projects" in sq for sq in subqueries)


def test_decompose_query_vs() -> None:
    """Queries with 'vs' should be split into comparative components."""
    query = "React vs Angular experience"
    subqueries = decompose_query(query, max_subqueries=3)
    assert len(subqueries) == 2
    assert "React" in subqueries[0]
    assert "Angular" in subqueries[1]


def test_decompose_query_as_well_as() -> None:
    """Queries with 'as well as' should be split into constituent parts."""
    query = "Tell me about his frontend work as well as his backend work"
    subqueries = decompose_query(query, max_subqueries=3)
    assert len(subqueries) == 2
    assert "frontend" in subqueries[0]
    assert "backend" in subqueries[1]


def test_decompose_query_both_and() -> None:
    """Queries with 'both X and Y' should be split."""
    query = "Tell me about both his education at ESPRIT and his experience at Novatek"
    subqueries = decompose_query(query, max_subqueries=3)
    assert len(subqueries) == 2
    assert any("ESPRIT" in sq for sq in subqueries)
    assert any("Novatek" in sq for sq in subqueries)


def test_decompose_query_max_subqueries_bound() -> None:
    """Ensure decomposition never exceeds max_subqueries."""
    query = "What is his degree? What did he do at Novatek? What did he do at Tunisair? What are his skills?"
    subqueries = decompose_query(query, max_subqueries=3)
    assert len(subqueries) == 3


def test_decompose_query_empty_or_whitespace() -> None:
    """Empty or whitespace queries return the original query list."""
    assert decompose_query("", max_subqueries=3) == [""]
    assert decompose_query("   ", max_subqueries=3) == [""]
