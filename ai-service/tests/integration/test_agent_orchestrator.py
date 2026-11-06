"""Integration tests for AgenticRAGOrchestrator with real store and mock Gemini client."""

from unittest.mock import MagicMock

import pytest

from app.agent.orchestrator import AgenticRAGOrchestrator
from app.agent.schemas import AgentAnswerRequest
from app.config import Settings
from app.rag.grounding import INSUFFICIENT_EVIDENCE_REPLY
from app.rag.service import RAGService
from app.rag.store import PortfolioVectorStore


@pytest.fixture
def real_vector_store() -> PortfolioVectorStore:
    """Load the real precomputed portfolio vector store."""
    return PortfolioVectorStore.from_file()


@pytest.mark.asyncio
async def test_orchestrator_out_of_scope_abstains_immediately(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Out-of-scope query abstains immediately without embedding or LLM calls."""
    mock_client = MagicMock()
    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    orchestrator = AgenticRAGOrchestrator(
        rag_service=service,
        settings=test_settings,
    )

    request = AgentAnswerRequest(message="What is the capital of France?")
    response = await orchestrator.answer(request)

    assert response.reply == INSUFFICIENT_EVIDENCE_REPLY
    assert response.sources == []
    assert response.metadata.abstained is True
    assert response.metadata.intent == "out_of_scope"
    assert response.metadata.retrieval_count == 0
    mock_client.models.embed_content.assert_not_called()
    mock_client.models.generate_content.assert_not_called()


@pytest.mark.asyncio
async def test_orchestrator_multi_part_decomposition_and_merge(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Multi-part query decomposes into subqueries, merges evidence, and calls LLM with XML fencing."""
    mock_client = MagicMock()

    # Mock embeddings to match the first vector in store
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    # Mock LLM generation
    mock_gen_resp = MagicMock()
    mock_gen_resp.text = (
        "Iheb has experience with both backend systems and AI projects."
    )
    mock_client.models.generate_content.return_value = mock_gen_resp

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    orchestrator = AgenticRAGOrchestrator(
        rag_service=service,
        settings=test_settings,
    )

    request = AgentAnswerRequest(
        message="Compare Iheb's backend experience and his AI projects"
    )
    response = await orchestrator.answer(request)

    assert response.metadata.intent == "multi_part"
    assert len(response.metadata.subqueries) >= 2
    assert response.metadata.subqueries_count >= 2
    assert response.metadata.abstained is False
    assert len(response.sources) > 0
    assert (
        response.reply
        == "Iheb has experience with both backend systems and AI projects."
    )

    # Verify generate_content was called
    assert mock_client.models.generate_content.called
    call_args = mock_client.models.generate_content.call_args
    # Contents passed to model should contain XML context tags
    contents = call_args.kwargs.get("contents") or call_args.args[1]
    prompt_text = contents[0].parts[0].text
    assert "<retrieved_context>" in prompt_text
    assert "</retrieved_context>" in prompt_text


@pytest.mark.asyncio
async def test_orchestrator_insufficient_evidence_abstains(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """When evidence is insufficient (e.g. score below threshold), orchestrator abstains."""
    mock_client = MagicMock()
    # Mock embedding with low-scoring vector
    mock_emb = MagicMock()
    mock_emb.values = [0.001] * 768
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    orchestrator = AgenticRAGOrchestrator(
        rag_service=service,
        settings=test_settings,
    )

    # Use a high threshold that no chunk will satisfy
    request = AgentAnswerRequest(
        message="Tell me about Iheb's work with quantum mechanics",
        threshold=0.99,
    )
    response = await orchestrator.answer(request)

    assert response.reply == INSUFFICIENT_EVIDENCE_REPLY
    assert response.sources == []
    assert response.metadata.abstained is True
    mock_client.models.generate_content.assert_not_called()


@pytest.mark.asyncio
async def test_orchestrator_career_advice_intent(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Career advice queries route to career_advice intent and ground with portfolio evidence."""
    mock_client = MagicMock()
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    mock_gen_resp = MagicMock()
    mock_gen_resp.text = "Based on Iheb's career path in full-stack development, focus on strong fundamentals."
    mock_client.models.generate_content.return_value = mock_gen_resp

    service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    orchestrator = AgenticRAGOrchestrator(
        rag_service=service,
        settings=test_settings,
    )

    request = AgentAnswerRequest(
        message="What career advice would you give for learning Spring Boot?"
    )
    response = await orchestrator.answer(request)

    assert response.metadata.intent == "career_advice"
    assert response.metadata.abstained is False
    assert len(response.sources) > 0
    assert (
        "spring" in response.reply.lower() or "fundamentals" in response.reply.lower()
    )
