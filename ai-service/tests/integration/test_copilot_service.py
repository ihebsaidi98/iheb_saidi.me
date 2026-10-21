"""Integration tests for CareerCopilotService with real vector store."""

from unittest.mock import MagicMock

import pytest

from app.config import Settings
from app.copilot.schemas import JobMatchAnalysisRequest, ProjectDeepDiveRequest
from app.copilot.service import CareerCopilotService
from app.rag.service import RAGService
from app.rag.store import PortfolioVectorStore


@pytest.fixture
def real_vector_store() -> PortfolioVectorStore:
    """Load the real precomputed portfolio vector store."""
    return PortfolioVectorStore.from_file()


@pytest.mark.asyncio
async def test_copilot_match_job_high_compatibility(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """JD requiring Java, Spring Boot, React, TypeScript should yield high match score and sources."""
    mock_client = MagicMock()
    # Mock embedding for search
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    rag_service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    copilot = CareerCopilotService(
        store=real_vector_store,
        rag_service=rag_service,
        settings=test_settings,
    )

    req = JobMatchAnalysisRequest(
        job_description=(
            "We are seeking a Senior Full Stack Engineer proficient in Java, "
            "Spring Boot, React, TypeScript, Docker, and PostgreSQL."
        ),
        target_role="Senior Full Stack Engineer",
    )
    res = await copilot.match_job(req)

    assert res.match_score >= 0.85
    matched_names = [
        item.skill for item in res.matched_skills if item.status == "matched"
    ]
    assert "Java" in matched_names
    assert "Spring Boot" in matched_names
    assert "React" in matched_names
    assert "TypeScript" in matched_names
    assert len(res.strengths) > 0
    assert len(res.cited_sources) > 0
    assert (
        "compatibility rating" in res.summary.lower()
        or "candidate" in res.summary.lower()
    )


@pytest.mark.asyncio
async def test_copilot_match_job_gaps(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """JD requiring Golang, Rust, and C++ identifies gaps properly."""
    mock_client = MagicMock()
    target_vec = real_vector_store.normalized_matrix[0].tolist()
    mock_emb = MagicMock()
    mock_emb.values = target_vec
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    rag_service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    copilot = CareerCopilotService(
        store=real_vector_store,
        rag_service=rag_service,
        settings=test_settings,
    )

    req = JobMatchAnalysisRequest(
        job_description="Seeking a systems engineer with extensive Golang, Rust, and C++ experience.",
        target_role="Systems Engineer",
    )
    res = await copilot.match_job(req)

    assert res.match_score == 0.0
    assert "Golang" in res.gap_skills
    assert "Rust" in res.gap_skills
    assert "C++" in res.gap_skills


@pytest.mark.asyncio
async def test_copilot_project_deep_dive_novatek(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Deep dive into Novatek project retrieves actual project metadata and technologies."""
    mock_client = MagicMock()
    rag_service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    copilot = CareerCopilotService(
        store=real_vector_store,
        rag_service=rag_service,
        settings=test_settings,
    )

    req = ProjectDeepDiveRequest(project_keyword="Novatek")
    res = await copilot.deep_dive_project(req)

    assert "novatek" in res.project_title.lower()
    assert len(res.technologies) > 0
    assert len(res.architecture_highlights) > 0
    assert len(res.sources) > 0


@pytest.mark.asyncio
async def test_copilot_project_deep_dive_nonexistent(
    real_vector_store: PortfolioVectorStore, test_settings: Settings
) -> None:
    """Deep dive for non-existent keyword returns structured fallback response."""
    mock_client = MagicMock()
    # Mock search returning empty results
    mock_emb = MagicMock()
    mock_emb.values = [0.001] * 768
    mock_emb_resp = MagicMock()
    mock_emb_resp.embeddings = [mock_emb]
    mock_client.models.embed_content.return_value = mock_emb_resp

    rag_service = RAGService(
        store=real_vector_store,
        settings=test_settings,
        gemini_client=mock_client,
    )
    copilot = CareerCopilotService(
        store=real_vector_store,
        rag_service=rag_service,
        settings=test_settings,
    )

    req = ProjectDeepDiveRequest(project_keyword="QuantumSupercomputerXYZ")
    res = await copilot.deep_dive_project(req)

    assert "No matching project records found" in res.summary
    assert res.sources == []
