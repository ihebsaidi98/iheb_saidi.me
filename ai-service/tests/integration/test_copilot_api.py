"""Integration tests for Career Copilot endpoints (/v1/copilot/*)."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.copilot.schemas import (
    JobMatchAnalysisResponse,
    ProjectDeepDiveResponse,
    SkillMatchItem,
)
from app.copilot.service import CareerCopilotService
from app.dependencies import get_career_copilot_service
from app.main import create_app
from app.rag.schemas import ChatSource


@pytest.fixture
def mock_copilot_service() -> MagicMock:
    """Mock CareerCopilotService for deterministic API contract tests."""
    mock = MagicMock(spec=CareerCopilotService)
    mock.match_job = AsyncMock()
    mock.deep_dive_project = AsyncMock()
    return mock


@pytest.fixture
async def copilot_client(
    test_settings: Settings, mock_copilot_service: MagicMock
) -> AsyncClient:
    """AsyncClient wired with overridden mock copilot service."""
    test_settings.career_copilot_enabled = True
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_career_copilot_service] = lambda: mock_copilot_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


# --- Authentication Guard Tests ---


@pytest.mark.asyncio
async def test_copilot_match_job_unauthorized(copilot_client: AsyncClient) -> None:
    """Calling match-job without internal token returns 401 Unauthorized."""
    resp = await copilot_client.post(
        "/v1/copilot/match-job",
        json={"job_description": "We are seeking a senior Java engineer."},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_copilot_deep_dive_unauthorized(copilot_client: AsyncClient) -> None:
    """Calling project-deep-dive without internal token returns 401 Unauthorized."""
    resp = await copilot_client.post(
        "/v1/copilot/project-deep-dive",
        json={"project_keyword": "Novatek"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


# --- Validation Tests ---


@pytest.mark.asyncio
async def test_copilot_validation_errors(copilot_client: AsyncClient) -> None:
    """Rejects payload violating constraints."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}

    # Job description too short (< 20 chars)
    resp1 = await copilot_client.post(
        "/v1/copilot/match-job",
        json={"job_description": "Too short"},
        headers=headers,
    )
    assert resp1.status_code == 422

    # Project keyword too short (< 2 chars)
    resp2 = await copilot_client.post(
        "/v1/copilot/project-deep-dive",
        json={"project_keyword": "a"},
        headers=headers,
    )
    assert resp2.status_code == 422


# --- Feature Flag Tests ---


@pytest.mark.asyncio
async def test_copilot_disabled_by_feature_flag(
    test_settings: Settings, mock_copilot_service: MagicMock
) -> None:
    """Returns 503 CAREER_COPILOT_DISABLED when feature flag is disabled."""
    test_settings.career_copilot_enabled = False
    app = create_app(settings=test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_career_copilot_service] = lambda: mock_copilot_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        headers = {"X-Internal-Token": "valid-test-internal-token"}
        resp = await client.post(
            "/v1/copilot/match-job",
            json={
                "job_description": "We need a senior full-stack Java and React engineer."
            },
            headers=headers,
        )
        assert resp.status_code == 503
        assert resp.json()["error"]["code"] == "CAREER_COPILOT_DISABLED"

        resp2 = await client.post(
            "/v1/copilot/project-deep-dive",
            json={"project_keyword": "Novatek"},
            headers=headers,
        )
        assert resp2.status_code == 503
        assert resp2.json()["error"]["code"] == "CAREER_COPILOT_DISABLED"


# --- Success Contract Tests ---


@pytest.mark.asyncio
async def test_copilot_match_job_success(
    copilot_client: AsyncClient, mock_copilot_service: MagicMock
) -> None:
    """Successful match-job returns 200 with structured response."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_copilot_service.match_job.return_value = JobMatchAnalysisResponse(
        match_score=0.88,
        matched_skills=[
            SkillMatchItem(
                skill="Java",
                proficiency="Advanced",
                status="matched",
                evidence_chunk_ids=["chunk1"],
            )
        ],
        gap_skills=["Rust"],
        strengths=["Strong Java microservices experience"],
        summary="Candidate is an excellent match.",
        cited_sources=[ChatSource(id="doc1", title="Backend Skills", type="skills")],
    )

    resp = await copilot_client.post(
        "/v1/copilot/match-job",
        json={
            "job_description": "We are seeking a senior Java engineer with microservices expertise.",
            "target_role": "Senior Backend Engineer",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["match_score"] == 0.88
    assert len(data["matched_skills"]) == 1
    assert data["matched_skills"][0]["skill"] == "Java"
    assert data["gap_skills"] == ["Rust"]
    assert len(data["cited_sources"]) == 1


@pytest.mark.asyncio
async def test_copilot_project_deep_dive_success(
    copilot_client: AsyncClient, mock_copilot_service: MagicMock
) -> None:
    """Successful project deep dive returns 200 with architecture report."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_copilot_service.deep_dive_project.return_value = ProjectDeepDiveResponse(
        project_title="Novatek Industrial Platform",
        role="Full Stack Engineer",
        company="Novatek (Délice Group)",
        period="Jul 2024 – Jan 2026",
        technologies=["Java", "Spring Boot", "Angular"],
        architecture_highlights=["Microservices architecture with Spring Cloud"],
        impact_metrics=["30% downtime reduction"],
        summary="Detailed project summary.",
        sources=[
            ChatSource(id="doc-novatek", title="Novatek Platform", type="project")
        ],
    )

    resp = await copilot_client.post(
        "/v1/copilot/project-deep-dive",
        json={"project_keyword": "Novatek"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_title"] == "Novatek Industrial Platform"
    assert data["role"] == "Full Stack Engineer"
    assert "Java" in data["technologies"]
    assert len(data["sources"]) == 1


@pytest.mark.asyncio
async def test_copilot_service_error(
    copilot_client: AsyncClient, mock_copilot_service: MagicMock
) -> None:
    """Unhandled exception converts to 502 COPILOT_ERROR."""
    headers = {"X-Internal-Token": "valid-test-internal-token"}
    mock_copilot_service.match_job.side_effect = RuntimeError(
        "Database connection error"
    )

    resp = await copilot_client.post(
        "/v1/copilot/match-job",
        json={
            "job_description": "We need a senior full-stack Java and React engineer."
        },
        headers=headers,
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "COPILOT_ERROR"
