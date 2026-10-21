"""Unit tests for Career Copilot skill extraction and portfolio matching."""

from app.copilot.matcher import extract_skills_from_jd, match_skills_against_portfolio
from app.rag.store import PortfolioVectorStore


def test_extract_skills_from_jd_detects_core_stack() -> None:
    """Detects primary technologies mentioned in JD text."""
    jd = """
    We are looking for a Senior Full Stack Engineer with strong experience in
    Java and Spring Boot microservices. The candidate must know React or Next.js,
    TypeScript, Docker, PostgreSQL, and CI/CD pipelines. Knowledge of AWS and Kubernetes is a plus.
    """
    skills = extract_skills_from_jd(jd)
    assert "Java" in skills
    assert "Spring Boot" in skills
    assert "React" in skills
    assert "Next.js" in skills
    assert "TypeScript" in skills
    assert "Docker" in skills
    assert "PostgreSQL" in skills
    assert "CI/CD" in skills
    assert "AWS" in skills
    assert "Kubernetes" in skills


def test_extract_skills_empty_or_no_tech() -> None:
    """Empty or non-technical text yields empty skill list."""
    assert extract_skills_from_jd("") == []
    assert extract_skills_from_jd("We value team players and communication.") == []


def test_match_skills_against_portfolio_scoring() -> None:
    """Calculates match score, matched items, and gap skills correctly."""
    store = PortfolioVectorStore.from_file()

    # Mix of matched, partial, and gap skills
    extracted = ["Java", "Spring Boot", "TypeScript", "AWS", "Golang"]
    matched_items, gap_skills, match_score = match_skills_against_portfolio(
        extracted, store
    )

    assert "Golang" in gap_skills
    assert "Golang" in [item.skill for item in matched_items if item.status == "gap"]

    matched_names = [item.skill for item in matched_items if item.status == "matched"]
    assert "Java" in matched_names
    assert "Spring Boot" in matched_names
    assert "TypeScript" in matched_names

    partial_names = [item.skill for item in matched_items if item.status == "partial"]
    assert "AWS" in partial_names

    # Java (1.0) + Spring Boot (1.0) + TypeScript (1.0) + AWS (0.5) + Golang (0.0) = 3.5 / 5 = 0.7
    assert 0.65 <= match_score <= 0.75


def test_match_skills_empty_extracted() -> None:
    """Empty extracted skills returns empty lists and 0.0 score."""
    store = PortfolioVectorStore.from_file()
    matched_items, gap_skills, score = match_skills_against_portfolio([], store)
    assert matched_items == []
    assert gap_skills == []
    assert score == 0.0
