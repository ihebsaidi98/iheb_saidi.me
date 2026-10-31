"""Unit tests for Mixed-Format Interview Simulator schemas."""

import pytest
from pydantic import ValidationError

from app.interview.schemas import (
    InterviewQuestion,
    MCQResult,
    SessionCompletionReport,
    StartInterviewRequest,
    SubmitAnswerAck,
    SubmitAnswerRequest,
    TopicScore,
    WrittenResult,
    WrittenRubricScore,
)


def test_start_interview_request_defaults() -> None:
    """StartInterviewRequest applies defaults (full_stack)."""
    req = StartInterviewRequest()
    assert req.track == "full_stack"
    assert req.focus_areas == []


def test_start_interview_request_extra_forbidden() -> None:
    """Extra unexpected fields are forbidden."""
    with pytest.raises(ValidationError):
        StartInterviewRequest(unexpected_arg="not_allowed")  # type: ignore[call-arg]


def test_submit_answer_request_validation() -> None:
    """SubmitAnswerRequest validates answer presence, session token, and bounds."""
    with pytest.raises(ValidationError):
        SubmitAnswerRequest(
            session_id="s1",
            session_token="tok1",
            question_id="q1",
            answer="",  # < 1 char
        )

    req = SubmitAnswerRequest(
        session_id="session-123",
        session_token="tok-456",
        question_id="fs-mcq-01",
        answer="201 Created",
    )
    assert req.session_id == "session-123"
    assert req.session_token == "tok-456"
    assert req.question_id == "fs-mcq-01"


def test_written_rubric_score_bounds() -> None:
    """WrittenRubricScore values must fall between 1.0 and 5.0."""
    with pytest.raises(ValidationError):
        WrittenRubricScore(
            accuracy=0.5,  # < 1.0
            depth=3.0,
            clarity=3.0,
            problem_solving=3.0,
            overall_score=2.5,
        )

    with pytest.raises(ValidationError):
        WrittenRubricScore(
            accuracy=5.5,  # > 5.0
            depth=3.0,
            clarity=3.0,
            problem_solving=3.0,
            overall_score=4.0,
        )

    rubric = WrittenRubricScore(
        accuracy=4.5,
        depth=4.0,
        clarity=4.2,
        problem_solving=4.5,
        overall_score=4.3,
    )
    assert rubric.overall_score == 4.3


def test_interview_question_model() -> None:
    """InterviewQuestion validates question structure and excludes correct_answer_index."""
    q = InterviewQuestion(
        question_id="fs-mcq-01",
        question_number=1,
        total_questions=10,
        question_text="Sample question?",
        question_type="mcq",
        track="full_stack",
        topic="HTTP",
        options=["A", "B", "C", "D"],
    )
    assert q.question_number == 1
    assert q.question_type == "mcq"
    assert len(q.options) == 4
    # Ensure correct_answer_index is not a field on InterviewQuestion
    assert not hasattr(q, "correct_answer_index")


def test_submit_answer_ack_structure() -> None:
    """SubmitAnswerAck provides blind acknowledgement without revealing scores."""
    ack = SubmitAnswerAck(
        session_id="s1",
        question_id="q1",
        question_number=1,
        answered_count=1,
        total_questions=10,
        is_complete=False,
    )
    assert ack.answered_count == 1
    assert ack.is_complete is False
    assert ack.next_question is None


def test_session_completion_report_structure() -> None:
    """SessionCompletionReport contains overall score, sub-scores, and detailed results."""
    mcq = MCQResult(
        question_id="fs-mcq-01",
        question_number=1,
        topic="HTTP",
        question_text="Which status code?",
        options=["200", "201", "204", "301"],
        submitted_answer="201",
        correct_answer="201",
        correct_answer_index=1,
        is_correct=True,
        source_url="https://datatracker.ietf.org/doc/html/rfc7231",
        source_title="RFC 7231",
        explanation="201 Created explanation",
    )
    written = WrittenResult(
        question_id="fs-open-06",
        question_number=6,
        topic="CORS",
        question_text="Explain CORS?",
        submitted_answer="CORS is a security mechanism...",
        rubric=WrittenRubricScore(
            accuracy=4.0,
            depth=4.0,
            clarity=4.0,
            problem_solving=4.0,
            overall_score=4.0,
        ),
        strengths=["Good explanation"],
        areas_for_improvement=["Mention preflight headers"],
        ideal_answer="Ideal answer...",
        source_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
        source_title="MDN CORS",
    )
    topic = TopicScore(topic="HTTP", score=10.0, max_score=10.0)

    report = SessionCompletionReport(
        session_id="s1",
        track="full_stack",
        score_out_of_100=85.0,
        mcq_score=45.0,
        written_score=40.0,
        mcq_results=[mcq],
        written_results=[written],
        topic_breakdown=[topic],
        overall_strengths=["Strong HTTP fundamentals"],
        overall_improvements=["Expand on CORS preflight"],
        total_questions=10,
    )
    assert report.score_out_of_100 == 85.0
    assert len(report.mcq_results) == 1
    assert len(report.written_results) == 1
    assert report.mcq_results[0].is_correct is True
