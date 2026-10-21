"""Pydantic schemas for Adaptive Interview Simulator."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.rag.schemas import ChatSource

InterviewTrack = Literal["full_stack", "backend_architecture", "ai_rag"]
InterviewDifficulty = Literal["standard", "senior", "lead"]


class StartInterviewRequest(BaseModel):
    """Payload for POST /v1/interview/start."""

    model_config = ConfigDict(extra="forbid")

    track: InterviewTrack = Field(
        default="full_stack",
        description="Interview specialization track (full_stack, backend_architecture, or ai_rag)",
    )
    difficulty: InterviewDifficulty = Field(
        default="senior",
        description="Target difficulty level (standard, senior, lead)",
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        max_length=10,
        description="Optional specific areas or technologies to emphasize (max 10)",
    )

    @field_validator("focus_areas")
    @classmethod
    def validate_focus_areas(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in values:
            s = item.strip()
            if not s:
                continue
            if len(s) > 50:
                raise ValueError(
                    f"Each focus area must be at most 50 characters, got {len(s)}."
                )
            cleaned.append(s)
        return cleaned


class InterviewQuestion(BaseModel):
    """Technical interview question grounded in portfolio experience."""

    question_id: str
    question_text: str
    track: InterviewTrack
    difficulty: InterviewDifficulty
    context_source: ChatSource | None = None
    expected_talking_points: list[str] = Field(default_factory=list)


class StartInterviewResponse(BaseModel):
    """Response returned when an interview session is initialized."""

    session_id: str
    track: InterviewTrack
    difficulty: InterviewDifficulty
    initial_question: InterviewQuestion


class SubmitAnswerRequest(BaseModel):
    """Payload for POST /v1/interview/submit-answer."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Active session identifier",
    )
    question_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Identifier of the question being answered",
    )
    answer: str = Field(
        ...,
        min_length=10,
        max_length=3000,
        description="Candidate's technical response",
    )


class RubricScore(BaseModel):
    """Multi-criteria evaluation rubric scores (1.0 to 5.0 scale)."""

    technical_depth: float = Field(..., ge=1.0, le=5.0)
    architecture_accuracy: float = Field(..., ge=1.0, le=5.0)
    clarity: float = Field(..., ge=1.0, le=5.0)
    portfolio_relevance: float = Field(..., ge=1.0, le=5.0)
    overall_score: float = Field(..., ge=1.0, le=5.0)


class SubmitAnswerResponse(BaseModel):
    """Feedback and evaluation response for a submitted interview answer."""

    session_id: str
    question_id: str
    rubric: RubricScore
    strengths: list[str] = Field(default_factory=list)
    areas_for_improvement: list[str] = Field(default_factory=list)
    sample_ideal_answer: str
    next_question: InterviewQuestion | None = None
