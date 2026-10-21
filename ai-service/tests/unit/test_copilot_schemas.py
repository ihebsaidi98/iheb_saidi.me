"""Unit tests for Career Copilot Pydantic schemas."""

import pytest
from pydantic import ValidationError

from app.copilot.schemas import (
    JobMatchAnalysisRequest,
    JobMatchAnalysisResponse,
    ProjectDeepDiveRequest,
    ProjectDeepDiveResponse,
    SkillMatchItem,
)
from app.rag.schemas import ChatSource


def test_job_match_analysis_request_valid() -> None:
    """Valid job match analysis request accepts job description and target role."""
    req = JobMatchAnalysisRequest(
        job_description="We need a senior software engineer with 5+ years of Java experience.",
        target_role="Senior Java Engineer",
    )
    assert req.target_role == "Senior Java Engineer"
    assert "Java" in req.job_description


def test_job_match_analysis_request_too_short() -> None:
    """Job description shorter than 20 chars raises ValidationError."""
    with pytest.raises(ValidationError):
        JobMatchAnalysisRequest(job_description="Too short")


def test_job_match_analysis_request_extra_forbidden() -> None:
    """Extra unexpected fields are forbidden."""
    with pytest.raises(ValidationError):
        JobMatchAnalysisRequest(
            job_description="We need a senior software engineer with 5+ years of Java experience.",
            unexpected_field="disallowed",  # type: ignore[call-arg]
        )


def test_project_deep_dive_request_validation() -> None:
    """Project deep dive request rejects empty string or single character."""
    with pytest.raises(ValidationError):
        ProjectDeepDiveRequest(project_keyword="")

    with pytest.raises(ValidationError):
        ProjectDeepDiveRequest(project_keyword="a")

    req = ProjectDeepDiveRequest(project_keyword="Novatek")
    assert req.project_keyword == "Novatek"


def test_job_match_analysis_response_score_bounds() -> None:
    """Match score must be between 0.0 and 1.0."""
    with pytest.raises(ValidationError):
        JobMatchAnalysisResponse(
            match_score=1.5,
            summary="Invalid score",
        )

    resp = JobMatchAnalysisResponse(
        match_score=0.85,
        matched_skills=[
            SkillMatchItem(
                skill="Java",
                proficiency="Advanced",
                status="matched",
                evidence_chunk_ids=["chunk1"],
            )
        ],
        gap_skills=["Rust"],
        strengths=["Strong Java background"],
        summary="Candidate is a strong match.",
        cited_sources=[ChatSource(id="chunk1", title="Backend Skills", type="skills")],
    )
    assert resp.match_score == 0.85
    assert len(resp.matched_skills) == 1
    assert resp.gap_skills == ["Rust"]


def test_project_deep_dive_response_structure() -> None:
    """ProjectDeepDiveResponse correctly structures architecture highlights and sources."""
    resp = ProjectDeepDiveResponse(
        project_title="Novatek Industrial Platform",
        role="Full Stack Engineer",
        company="Novatek (Délice Group)",
        period="Jul 2024 – Jan 2026",
        technologies=["Java", "Spring Boot", "Angular"],
        architecture_highlights=["Engineered microservices architecture"],
        impact_metrics=["Reduced downtime by 30%"],
        summary="Deep dive summary.",
        sources=[ChatSource(id="doc-novatek", title="Novatek", type="project")],
    )
    assert resp.company == "Novatek (Délice Group)"
    assert len(resp.technologies) == 3
    assert len(resp.impact_metrics) == 1
