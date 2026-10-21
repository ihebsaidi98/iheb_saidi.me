"""Unit tests for Adaptive Interview Simulator schemas."""

import pytest
from pydantic import ValidationError

from app.interview.schemas import (
    InterviewQuestion,
    RubricScore,
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
)


def test_start_interview_request_defaults() -> None:
    """StartInterviewRequest applies defaults (full_stack, senior)."""
    req = StartInterviewRequest()
    assert req.track == "full_stack"
    assert req.difficulty == "senior"
    assert req.focus_areas == []


def test_start_interview_request_extra_forbidden() -> None:
    """Extra unexpected fields are forbidden."""
    with pytest.raises(ValidationError):
        StartInterviewRequest(unexpected_arg="not_allowed")  # type: ignore[call-arg]


def test_submit_answer_request_validation() -> None:
    """SubmitAnswerRequest validates answer length and required fields."""
    with pytest.raises(ValidationError):
        SubmitAnswerRequest(
            session_id="s1",
            question_id="q1",
            answer="Short",  # < 10 chars
        )

    req = SubmitAnswerRequest(
        session_id="session-123",
        question_id="fs-01",
        answer="A valid technical answer explaining tenant isolation in multi-tenant SaaS.",
    )
    assert req.session_id == "session-123"
    assert req.question_id == "fs-01"


def test_rubric_score_bounds() -> None:
    """RubricScore values must fall between 1.0 and 5.0."""
    with pytest.raises(ValidationError):
        RubricScore(
            technical_depth=0.5,  # < 1.0
            architecture_accuracy=3.0,
            clarity=3.0,
            portfolio_relevance=3.0,
            overall_score=2.5,
        )

    with pytest.raises(ValidationError):
        RubricScore(
            technical_depth=5.5,  # > 5.0
            architecture_accuracy=3.0,
            clarity=3.0,
            portfolio_relevance=3.0,
            overall_score=4.0,
        )

    rubric = RubricScore(
        technical_depth=4.5,
        architecture_accuracy=4.0,
        clarity=4.2,
        portfolio_relevance=4.5,
        overall_score=4.3,
    )
    assert rubric.overall_score == 4.3


def test_start_interview_response_structure() -> None:
    """StartInterviewResponse contains session ID and initial question."""
    q = InterviewQuestion(
        question_id="fs-01",
        question_text="Sample question text?",
        track="full_stack",
        difficulty="senior",
        expected_talking_points=["point1", "point2"],
    )
    resp = StartInterviewResponse(
        session_id="session-xyz",
        track="full_stack",
        difficulty="senior",
        initial_question=q,
    )
    assert resp.session_id == "session-xyz"
    assert resp.initial_question.question_id == "fs-01"
