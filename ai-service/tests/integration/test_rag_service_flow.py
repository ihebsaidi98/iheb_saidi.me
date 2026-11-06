"""Integration tests for end-to-end RAGService flow with real store and mock Gemini client."""

from unittest.mock import MagicMock

import numpy as np
import pytest

from app.config import Settings
from app.rag.grounding import INSUFFICIENT_EVIDENCE_REPLY
from app.rag.service import RAGService
from app.rag.store import PortfolioVectorStore


@pytest.fixture
def real_vector_store() -> PortfolioVectorStore:
    """Load the real precomputed portfolio vector store."""
    return PortfolioVectorStore.from_file()


@pytest.mark.asyncio
async def test_end_to_end_search_flow(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
):
    """Verify search flow through RAGService using real vector store."""
    mock_client = MagicMock()
    # Mock embedding return: vector matching the first record in the store
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_response = MagicMock()
    mock_response.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_response

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    response = await service.search(
        query="Iheb's technical profile", limit=3, threshold=0.3
    )

    assert response.total > 0
    assert len(response.results) <= 3
    # First result should have score ~ 1.0 since we mocked the exact vector
    assert np.isclose(response.results[0].score, 1.0, atol=1e-3)
    assert response.index_version == real_vector_store.kb_version


@pytest.mark.asyncio
async def test_end_to_end_chat_grounded(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
):
    """Verify chat generation grounded in retrieved chunks."""
    mock_client = MagicMock()
    # Mock embedding
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    # Mock chat generation
    mock_gen_resp = MagicMock()
    mock_gen_resp.text = "Iheb Saidi is a software engineer with expertise in full-stack web development."
    mock_client.models.generate_content.return_value = mock_gen_resp

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    chat_res = await service.chat(message="Tell me about Iheb")

    assert (
        chat_res.reply
        == "Iheb Saidi is a software engineer with expertise in full-stack web development."
    )
    assert len(chat_res.sources) > 0
    # Ensure source contains expected fields
    assert hasattr(chat_res.sources[0], "id")
    assert hasattr(chat_res.sources[0], "title")


@pytest.mark.asyncio
async def test_chat_out_of_domain_skips_llm(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
):
    """If no chunks meet threshold, LLM should not be called and canned response returned."""
    mock_client = MagicMock()
    # Mock embedding vector that has low similarity to everything or threshold high
    mock_emb = MagicMock()
    mock_emb.values = [0.1] * 768
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    # Use threshold 0.99 so nothing matches
    chat_res = await service.chat(
        message="What is the weather on Jupiter?", threshold=0.99
    )

    assert chat_res.reply == INSUFFICIENT_EVIDENCE_REPLY
    assert chat_res.sources == []
    # Generation must not have been called!
    mock_client.models.generate_content.assert_not_called()


@pytest.mark.asyncio
async def test_chat_candidate_fallback(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
):
    """When primary model fails with retryable error (e.g. 503), fallback model is invoked."""
    mock_client = MagicMock()
    # Mock embedding
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    # First call (primary model) fails with 503 UNAVAILABLE
    # Second call (fallback model) succeeds
    success_resp = MagicMock()
    success_resp.text = "Answer from fallback model."

    def mock_gen_side_effect(model, contents, config):
        if model == test_settings.gemini_chat_model:
            raise RuntimeError("503 The model is overloaded. Please try again later.")
        return success_resp

    mock_client.models.generate_content.side_effect = mock_gen_side_effect

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    chat_res = await service.chat(message="Tell me about Iheb")
    assert chat_res.reply == "Answer from fallback model."
    assert mock_client.models.generate_content.call_count == 2


@pytest.mark.asyncio
async def test_chat_permanent_error_no_fallback(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
):
    """Permanent errors like 401 API_KEY_INVALID must fail immediately without trying other models."""
    from app.rag.service import RAGGenerationError

    mock_client = MagicMock()
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    mock_client.models.generate_content.side_effect = RuntimeError(
        "API_KEY_INVALID: The provided API key is expired or invalid."
    )

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )

    with pytest.raises(RAGGenerationError, match="Model generation failed"):
        await service.chat(message="Tell me about Iheb")

    # Exactly 1 call was made (no futile fallback loops on invalid API key)
    assert mock_client.models.generate_content.call_count == 1
