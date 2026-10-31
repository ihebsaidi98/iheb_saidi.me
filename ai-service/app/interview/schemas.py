"""Pydantic schemas for Mixed-Format Interview Simulator.

Session flow:
  POST /v1/interview/start  → StartInterviewResponse (session_token, first question)
  POST /v1/interview/submit-answer (×10) → SubmitAnswerAck (blind, no scores)
  POST /v1/interview/complete → SessionCompletionReport (full results)
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

InterviewTrack = Literal["full_stack", "backend", "frontend", "ai_ml"]
QuestionType = Literal["mcq", "open_ended"]

TOTAL_QUESTIONS = 10


# ---------------------------------------------------------------------------
# Start Interview
# ---------------------------------------------------------------------------


class StartInterviewRequest(BaseModel):
    """Payload for POST /v1/interview/start."""

    model_config = ConfigDict(extra="forbid")

    track: InterviewTrack = Field(
        default="full_stack",
        description="Interview specialization track",
    )
    difficulty: str | None = Field(
        default=None,
        description="Optional difficulty indicator (progression is 1-10 per session)",
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        max_length=10,
        description="Optional focus areas (max 10)",
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
    """A single interview question returned to the client.

    For MCQ questions, options are included but the correct_answer_index is
    NEVER sent to the client until the session is complete.
    """

    question_id: str
    question_number: int = Field(..., ge=1, le=TOTAL_QUESTIONS)
    total_questions: int = Field(default=TOTAL_QUESTIONS)
    question_text: str
    question_type: QuestionType
    track: InterviewTrack
    topic: str
    options: list[str] | None = None
    expected_talking_points: list[str] = Field(default_factory=list)


class StartInterviewResponse(BaseModel):
    """Response returned when an interview session is initialized."""

    session_id: str
    session_token: str
    track: InterviewTrack
    total_questions: int = TOTAL_QUESTIONS
    initial_question: InterviewQuestion


# ---------------------------------------------------------------------------
# Submit Answer (blind — no scores revealed per question)
# ---------------------------------------------------------------------------


class SubmitAnswerRequest(BaseModel):
    """Payload for POST /v1/interview/submit-answer."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=200)
    question_id: str = Field(..., min_length=1, max_length=100)
    answer: str = Field(..., min_length=1, max_length=3000)


class SubmitAnswerAck(BaseModel):
    """Blind acknowledgement for a submitted answer — no scores or feedback revealed."""

    session_id: str
    question_id: str
    question_number: int
    answered_count: int
    total_questions: int
    is_complete: bool
    next_question: InterviewQuestion | None = None


# ---------------------------------------------------------------------------
# Complete Session (full results revealed)
# ---------------------------------------------------------------------------


class CompleteSessionRequest(BaseModel):
    """Payload for POST /v1/interview/complete."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=200)


class MCQResult(BaseModel):
    """Result for a single MCQ question."""

    question_id: str
    question_number: int
    topic: str
    question_text: str
    options: list[str]
    submitted_answer: str
    correct_answer: str
    correct_answer_index: int
    is_correct: bool
    source_url: str
    source_title: str
    explanation: str


class WrittenRubricScore(BaseModel):
    """Multi-criteria rubric evaluation for an open-ended written answer (1.0–5.0 scale)."""

    accuracy: float = Field(..., ge=1.0, le=5.0)
    depth: float = Field(..., ge=1.0, le=5.0)
    clarity: float = Field(..., ge=1.0, le=5.0)
    problem_solving: float = Field(..., ge=1.0, le=5.0)
    overall_score: float = Field(..., ge=1.0, le=5.0)


class WrittenResult(BaseModel):
    """Result for a single open-ended written question."""

    question_id: str
    question_number: int
    topic: str
    question_text: str
    submitted_answer: str
    rubric: WrittenRubricScore
    strengths: list[str] = Field(default_factory=list)
    areas_for_improvement: list[str] = Field(default_factory=list)
    ideal_answer: str
    source_url: str
    source_title: str


class TopicScore(BaseModel):
    """Score breakdown by topic area."""

    topic: str
    score: float = Field(..., ge=0.0, le=100.0)
    max_score: float = Field(..., ge=0.0, le=100.0)


class SessionCompletionReport(BaseModel):
    """Full session results returned after all questions are answered."""

    session_id: str
    track: InterviewTrack
    score_out_of_100: float = Field(..., ge=0.0, le=100.0)
    mcq_score: float = Field(..., ge=0.0, le=100.0, description="MCQ sub-score /50")
    written_score: float = Field(
        ..., ge=0.0, le=100.0, description="Written sub-score /50"
    )
    mcq_results: list[MCQResult]
    written_results: list[WrittenResult]
    topic_breakdown: list[TopicScore]
    overall_strengths: list[str] = Field(default_factory=list)
    overall_improvements: list[str] = Field(default_factory=list)
    total_questions: int = TOTAL_QUESTIONS
