"""Unit tests for PortfolioVectorStore."""

import json
from pathlib import Path

import numpy as np
import pytest

from app.rag.store import (
    PortfolioVectorStore,
    VectorIndexCorruptError,
    VectorIndexNotFoundError,
)


def test_load_real_rag_index():
    """Verify that the repository's real rag-index.json loads and validates successfully."""
    store = PortfolioVectorStore.from_file()
    assert store.count > 0
    assert store.dimensions == 768
    assert store.model == "gemini-embedding-001"
    assert store.normalized_matrix.shape == (store.count, 768)
    # Check that rows are normalized to unit length
    norms = np.linalg.norm(store.normalized_matrix, axis=1)
    np.testing.assert_allclose(norms, 1.0, rtol=1e-5)


def test_matrix_immutability():
    """Ensure the normalized matrix cannot be accidentally mutated in memory."""
    store = PortfolioVectorStore.from_file()
    with pytest.raises(ValueError, match="read-only"):
        store.normalized_matrix[0, 0] = 999.0


def test_missing_index_file(tmp_path: Path):
    """Verify that a missing index file raises VectorIndexNotFoundError."""
    non_existent = tmp_path / "missing-index.json"
    with pytest.raises(VectorIndexNotFoundError):
        PortfolioVectorStore.from_file(file_path=non_existent)


def test_malformed_json_index(tmp_path: Path):
    """Verify that malformed JSON raises VectorIndexCorruptError."""
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("{ not valid json", encoding="utf-8")
    with pytest.raises(VectorIndexCorruptError, match="Malformed JSON"):
        PortfolioVectorStore.from_file(file_path=bad_file)


def test_root_not_object(tmp_path: Path):
    """Verify that a root JSON array raises VectorIndexCorruptError."""
    bad_file = tmp_path / "bad_array.json"
    bad_file.write_text("[]", encoding="utf-8")
    with pytest.raises(VectorIndexCorruptError, match="expected root JSON object"):
        PortfolioVectorStore.from_file(file_path=bad_file)


def test_model_mismatch(tmp_path: Path):
    """Verify that model mismatch raises VectorIndexCorruptError."""
    index_file = tmp_path / "mismatch.json"
    index_file.write_text(
        json.dumps(
            {
                "model": "text-embedding-ada-002",
                "dimensions": 768,
                "records": [
                    {
                        "id": "1",
                        "title": "T",
                        "text": "X",
                        "vector": [0.1] * 768,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(VectorIndexCorruptError, match="model mismatch"):
        PortfolioVectorStore.from_file(file_path=index_file)


def test_dimension_mismatch(tmp_path: Path):
    """Verify that dimension mismatch raises VectorIndexCorruptError."""
    index_file = tmp_path / "dim_mismatch.json"
    index_file.write_text(
        json.dumps(
            {
                "model": "gemini-embedding-001",
                "dimensions": 1536,
                "records": [
                    {
                        "id": "1",
                        "title": "T",
                        "text": "X",
                        "vector": [0.1] * 1536,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(VectorIndexCorruptError, match="dimension mismatch"):
        PortfolioVectorStore.from_file(file_path=index_file)


def test_empty_records(tmp_path: Path):
    """Verify that an index without records raises VectorIndexCorruptError."""
    index_file = tmp_path / "empty_records.json"
    index_file.write_text(
        json.dumps(
            {
                "model": "gemini-embedding-001",
                "dimensions": 768,
                "records": [],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(VectorIndexCorruptError, match="no records"):
        PortfolioVectorStore.from_file(file_path=index_file)


def test_record_count_mismatch(tmp_path: Path):
    """Verify that a discrepancy between recordsCount and records length raises VectorIndexCorruptError."""
    index_file = tmp_path / "count_mismatch.json"
    index_file.write_text(
        json.dumps(
            {
                "model": "gemini-embedding-001",
                "dimensions": 768,
                "recordsCount": 5,
                "records": [
                    {
                        "id": "1",
                        "title": "T",
                        "text": "X",
                        "vector": [0.1] * 768,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(VectorIndexCorruptError, match="records count mismatch"):
        PortfolioVectorStore.from_file(file_path=index_file)


def test_non_finite_vector(tmp_path: Path):
    """Verify that NaN or Inf values in vector raise VectorIndexCorruptError."""
    index_file = tmp_path / "nan_vector.json"
    # json null will be parsed as None or we can test float('nan') via manual object
    bad_data = {
        "model": "gemini-embedding-001",
        "dimensions": 768,
        "records": [
            {
                "id": "1",
                "title": "T",
                "text": "X",
                "vector": [float("nan")] + [0.1] * 767,
            }
        ],
    }
    index_file.write_text(json.dumps(bad_data), encoding="utf-8")
    with pytest.raises(VectorIndexCorruptError, match="non-finite"):
        PortfolioVectorStore.from_file(file_path=index_file)


def test_near_zero_norm_vector(tmp_path: Path):
    """Verify that an all-zero vector raises VectorIndexCorruptError."""
    index_file = tmp_path / "zero_vector.json"
    index_file.write_text(
        json.dumps(
            {
                "model": "gemini-embedding-001",
                "dimensions": 768,
                "records": [
                    {
                        "id": "1",
                        "title": "T",
                        "text": "X",
                        "vector": [0.0] * 768,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(VectorIndexCorruptError, match="near-zero magnitude"):
        PortfolioVectorStore.from_file(file_path=index_file)
