"""Unit tests for the interview question bank and retrieval functions."""

from app.interview.questions import (
    QUESTION_BANK,
    get_question_by_id,
    get_questions_by_track_and_difficulty,
)


def test_question_bank_structure() -> None:
    """Every question in the bank has required fields and valid tracks."""
    assert len(QUESTION_BANK) >= 6
    valid_tracks = {"full_stack", "backend_architecture", "ai_rag"}
    valid_difficulties = {"standard", "senior", "lead"}

    for q in QUESTION_BANK:
        assert q["question_id"]
        assert len(q["question_text"]) >= 20
        assert q["track"] in valid_tracks
        assert q["difficulty"] in valid_difficulties
        assert len(q.get("expected_talking_points", [])) >= 2
        assert len(q.get("ideal_answer", "")) >= 30


def test_get_questions_by_track_and_difficulty() -> None:
    """Filters questions accurately by track and difficulty."""
    fs_senior = get_questions_by_track_and_difficulty("full_stack", "senior")
    assert len(fs_senior) >= 1
    assert all(q["track"] == "full_stack" for q in fs_senior)

    be_lead = get_questions_by_track_and_difficulty("backend_architecture", "lead")
    assert len(be_lead) >= 1
    assert all(q["track"] == "backend_architecture" for q in be_lead)

    ai_standard = get_questions_by_track_and_difficulty("ai_rag", "standard")
    assert len(ai_standard) >= 1
    assert all(q["track"] == "ai_rag" for q in ai_standard)


def test_get_question_by_id_found() -> None:
    """Finds question by existing question_id."""
    q = get_question_by_id("fs-01")
    assert q is not None
    assert "AgroRetail" in q["question_text"]
    assert q["track"] == "full_stack"


def test_get_question_by_id_not_found() -> None:
    """Returns None for non-existent question_id."""
    assert get_question_by_id("non-existent-id-999") is None
