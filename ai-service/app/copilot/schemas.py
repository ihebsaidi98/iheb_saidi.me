"""Pydantic schemas for Career Copilot endpoints."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.rag.schemas import ChatSource

SkillMatchStatus = Literal["matched", "partial", "gap"]


class SkillMatchItem(BaseModel):
    """Evaluation of an individual skill requirement against portfolio evidence."""

    skill: str
    proficiency: str = Field(
        ...,
        description="Assessed proficiency: Advanced, Proficient, Familiar, or None",
    )
    status: SkillMatchStatus
    evidence_chunk_ids: list[str] = Field(default_factory=list)
    notes: str = ""


class JobMatchAnalysisRequest(BaseModel):
    """Payload for POST /v1/copilot/match-job."""

    model_config = ConfigDict(extra="forbid")

    job_description: str = Field(
        ...,
        min_length=20,
        max_length=5000,
        description="Target job description text to analyze against Iheb's profile",
    )
    target_role: str | None = Field(
        default=None,
        max_length=100,
        description="Optional title of the role (e.g. 'Senior Full-Stack Engineer')",
    )


class JobMatchAnalysisResponse(BaseModel):
    """Detailed skill alignment and gap analysis response."""

    match_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized compatibility score between 0.0 and 1.0",
    )
    matched_skills: list[SkillMatchItem] = Field(
        default_factory=list,
        description="Skills present or partially present in Iheb's portfolio",
    )
    gap_skills: list[str] = Field(
        default_factory=list,
        description="Required skills not found in portfolio evidence",
    )
    strengths: list[str] = Field(
        default_factory=list,
        description="Key alignment highlights based on concrete achievements",
    )
    summary: str = Field(
        ...,
        description="Synthesized executive summary of candidate fit",
    )
    cited_sources: list[ChatSource] = Field(
        default_factory=list,
        description="Grounded portfolio sources supporting the analysis",
    )


class ProjectDeepDiveRequest(BaseModel):
    """Payload for POST /v1/copilot/project-deep-dive."""

    model_config = ConfigDict(extra="forbid")

    project_keyword: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Keyword or project name (e.g. 'Novatek', 'AgroRetail', 'Chatbot')",
    )


class ProjectDeepDiveResponse(BaseModel):
    """Detailed technical architecture and impact report for a project."""

    project_title: str
    role: str
    company: str | None = None
    period: str | None = None
    technologies: list[str] = Field(default_factory=list)
    architecture_highlights: list[str] = Field(default_factory=list)
    impact_metrics: list[str] = Field(default_factory=list)
    summary: str
    sources: list[ChatSource] = Field(default_factory=list)
