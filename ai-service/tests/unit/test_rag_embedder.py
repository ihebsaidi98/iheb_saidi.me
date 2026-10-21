"""Unit tests for query embedder and secret redaction."""

from unittest.mock import MagicMock

import numpy as np
import pytest

from app.config import Settings
from app.core.safe_errors import redact_secrets
from app.rag.embedder import EmbedderError, embed_query


def test_embed_query_successful(test_settings: Settings):
    """Test successful embedding generation and unit normalization."""
    mock_client = MagicMock()
    # Mock return vector of 768 length with norm 2.0
    raw_vec = [2.0] + [0.0] * 767
    mock_embedding = MagicMock()
    mock_embedding.values = raw_vec
    mock_response = MagicMock()
    mock_response.embeddings = [mock_embedding]
    mock_client.models.embed_content.return_value = mock_response

    result_vec = embed_query("Who is Iheb?", mock_client, test_settings)

    assert result_vec.shape == (768,)
    # Magnitude should be exactly 1.0 (unit vector)
    assert np.isclose(np.linalg.norm(result_vec), 1.0)
    assert np.isclose(result_vec[0], 1.0)


def test_embed_query_empty_string(test_settings: Settings):
    """Empty query should raise EmbedderError immediately without network call."""
    mock_client = MagicMock()
    with pytest.raises(EmbedderError, match="Query string cannot be empty"):
        embed_query("   ", mock_client, test_settings)
    mock_client.models.embed_content.assert_not_called()


def test_embed_query_missing_client(test_settings: Settings):
    """Missing client raises EmbedderError."""
    with pytest.raises(EmbedderError, match="Gemini client is not configured"):
        embed_query("Valid query", None, test_settings)


def test_embed_query_dimension_mismatch(test_settings: Settings):
    """Dimension mismatch from API response raises EmbedderError."""
    mock_client = MagicMock()
    mock_embedding = MagicMock()
    mock_embedding.values = [0.1] * 512  # Wrong dimension (expected 768)
    mock_response = MagicMock()
    mock_response.embeddings = [mock_embedding]
    mock_client.models.embed_content.return_value = mock_response

    with pytest.raises(EmbedderError, match="Embedding dimension mismatch"):
        embed_query("Valid query", mock_client, test_settings)


def test_embed_query_redacts_api_key():
    """Verify that sensitive API keys in exception messages are redacted."""
    raw_msg = "Error connecting to https://generativelanguage.googleapis.com?key=AIzaSySecret12345"
    redacted = redact_secrets(raw_msg)
    assert "AIzaSySecret12345" not in redacted
    assert "key=[REDACTED]" in redacted
