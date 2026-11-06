"""Unit tests for the interview question bank and retrieval functions."""

from app.interview.questions import (
    QUESTION_BANK,
    get_question_by_id,
    get_questions_by_track_and_difficulty,
    get_questions_for_session,
    get_track_question_count,
)


def test_question_bank_structure() -> None:
    """Every question in the bank has required fields and valid generic attributes."""
    assert len(QUESTION_BANK) == 40  # 4 tracks × 10 questions
    valid_tracks = {"full_stack", "backend", "frontend", "ai_ml"}

    for q in QUESTION_BANK:
        assert q["question_id"]
        assert len(q["question_text"]) >= 20
        assert q["track"] in valid_tracks
        assert 1 <= q["difficulty"] <= 10
        assert q["topic"] != ""
        assert q["source_url"].startswith("http")
        assert q["source_title"] != ""
        assert len(q.get("ideal_answer", "")) >= 20

        # Generic question check: ensure no portfolio/CV keywords exist
        forbidden_keywords = [
            "agroretail",
            "novatek",
            "iheb",
            "cv",
            "resume",
            "my project",
        ]
        text_lower = (q["question_text"] + " " + q.get("ideal_answer", "")).lower()
        for kw in forbidden_keywords:
            assert kw not in text_lower, (
                f"Question {q['question_id']} contains personal keyword '{kw}'"
            )

        if q["question_type"] == "mcq":
            assert q["options"] is not None
            assert len(q["options"]) == 4
            assert 0 <= q["correct_answer_index"] <= 3
        else:
            assert q["question_type"] == "open_ended"
            assert q["options"] is None
            assert q["correct_answer_index"] is None
            assert len(q.get("expected_talking_points", [])) >= 3


def test_all_tracks_have_exactly_10_questions() -> None:
    """Each of the 4 tracks has exactly 10 questions (5 MCQ, 5 open-ended) progressing 1-10."""
    tracks = ["full_stack", "backend", "frontend", "ai_ml"]
    for trk in tracks:
        assert get_track_question_count(trk) == 10
        questions = get_questions_for_session(trk)
        assert len(questions) == 10

        # Difficulties must progress strictly 1 to 10
        difficulties = [q["difficulty"] for q in questions]
        assert difficulties == list(range(1, 11))

        # First 5 must be MCQ
        assert all(q["question_type"] == "mcq" for q in questions[:5])
        # Last 5 must be open-ended
        assert all(q["question_type"] == "open_ended" for q in questions[5:])


def test_get_questions_by_track_and_difficulty() -> None:
    """Helper returns sorted questions for track."""
    be = get_questions_by_track_and_difficulty("backend")
    assert len(be) == 10
    assert all(q["track"] == "backend" for q in be)


def test_get_question_by_id_found() -> None:
    """Finds question by existing question_id."""
    q = get_question_by_id("fs-mcq-01")
    assert q is not None
    assert "201 Created" in q["ideal_answer"]
    assert q["track"] == "full_stack"
    assert q["question_type"] == "mcq"


def test_get_question_by_id_not_found() -> None:
    """Returns None for non-existent question_id."""
    assert get_question_by_id("non-existent-id-999") is None


def test_mcq_answer_keys_are_consistent() -> None:
    """Every MCQ has 4 unique options and correct_answer_index points to a valid option."""
    mcqs = [q for q in QUESTION_BANK if q["question_type"] == "mcq"]
    assert len(mcqs) == 20  # 4 tracks × 5 MCQs

    for q in mcqs:
        options = q["options"]
        assert len(options) == 4
        assert len(set(options)) == 4, f"Duplicate options in {q['question_id']}"
        correct_idx = q["correct_answer_index"]
        assert 0 <= correct_idx < 4
        correct_text = options[correct_idx]
        assert len(correct_text) > 0
