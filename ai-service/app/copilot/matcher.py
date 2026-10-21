"""Deterministic skill extraction and portfolio matching engine for Career Copilot."""

import re

from app.copilot.schemas import SkillMatchItem
from app.rag.store import PortfolioVectorStore

SKILL_TAXONOMY: dict[str, list[str]] = {
    "Java": [r"\bjava\b"],
    "Spring Boot": [r"\bspring\s*boot\b", r"\bspring\b"],
    "TypeScript": [r"\btypescript\b", r"\bts\b"],
    "JavaScript": [r"\bjavascript\b"],
    "React": [r"\breact(\.?js)?\b"],
    "Next.js": [r"\bnext(\.?js)?\b"],
    "Angular": [r"\bangular\b"],
    "Python": [r"\bpython\b"],
    "Docker": [r"\bdocker\b"],
    "Kubernetes": [r"\bkubernetes\b", r"\bk8s\b"],
    "PostgreSQL": [r"\bpostgres(ql)?\b"],
    "MySQL": [r"\bmysql\b"],
    "MongoDB": [r"\bmongo(db)?\b"],
    "Redis": [r"\bredis\b"],
    "AWS": [r"\baws\b", r"\bamazon web services\b"],
    "GCP": [r"\bgcp\b", r"\bgoogle cloud\b"],
    "Azure": [r"\bazure\b"],
    "REST APIs": [r"\brest(ful)?\s*(api|service)?s?\b"],
    "Microservices": [r"\bmicroservices?\b"],
    "GraphQL": [r"\bgraphql\b"],
    "CI/CD": [r"\bci[/-]?cd\b", r"\bcontinuous integration\b"],
    "Git": [r"\bgit(hub|lab)?\b"],
    "RAG": [r"\brag\b", r"\bretrieval[- ]augmented\b"],
    "LLM": [r"\bllms?\b", r"\blarge language models?\b"],
    "Tailwind CSS": [r"\btailwind(css)?\b"],
    "Kafka": [r"\bkafka\b"],
    "Elasticsearch": [r"\belasticsearch\b"],
    "Golang": [r"\bgolang\b", r"\bgo\b"],
    "Rust": [r"\brust\b"],
    "C++": [r"\bc\+\+(?!\w)"],
    "Ruby": [r"\bruby(\s*on\s*rails)?\b"],
    "PHP": [r"\bphp\b"],
}

# Known proficiencies in Iheb's portfolio for primary skills
KNOWN_PORTFOLIO_SKILLS: dict[str, dict[str, str]] = {
    "Java": {"proficiency": "Advanced", "status": "matched"},
    "Spring Boot": {"proficiency": "Advanced", "status": "matched"},
    "TypeScript": {"proficiency": "Advanced", "status": "matched"},
    "JavaScript": {"proficiency": "Advanced", "status": "matched"},
    "React": {"proficiency": "Advanced", "status": "matched"},
    "Next.js": {"proficiency": "Advanced", "status": "matched"},
    "Angular": {"proficiency": "Proficient", "status": "matched"},
    "Python": {"proficiency": "Proficient", "status": "matched"},
    "Docker": {"proficiency": "Proficient", "status": "matched"},
    "PostgreSQL": {"proficiency": "Proficient", "status": "matched"},
    "MySQL": {"proficiency": "Proficient", "status": "matched"},
    "REST APIs": {"proficiency": "Advanced", "status": "matched"},
    "Microservices": {"proficiency": "Proficient", "status": "matched"},
    "CI/CD": {"proficiency": "Proficient", "status": "matched"},
    "Git": {"proficiency": "Advanced", "status": "matched"},
    "RAG": {"proficiency": "Advanced", "status": "matched"},
    "LLM": {"proficiency": "Proficient", "status": "matched"},
    "Tailwind CSS": {"proficiency": "Advanced", "status": "matched"},
    "AWS": {"proficiency": "Familiar", "status": "partial"},
    "Redis": {"proficiency": "Familiar", "status": "partial"},
    "MongoDB": {"proficiency": "Familiar", "status": "partial"},
}


def extract_skills_from_jd(text: str) -> list[str]:
    """Scan job description text and extract canonical tech skills."""
    extracted = []
    clean_text = text.lower()
    for skill_name, patterns in SKILL_TAXONOMY.items():
        for pattern in patterns:
            if re.search(pattern, clean_text):
                extracted.append(skill_name)
                break
    return sorted(extracted)


def match_skills_against_portfolio(
    extracted_skills: list[str],
    store: PortfolioVectorStore,
) -> tuple[list[SkillMatchItem], list[str], float]:
    """Evaluate extracted skills against precomputed portfolio vector store records.

    Returns:
        (matched_items, gap_skills, match_score)
    """
    if not extracted_skills:
        return [], [], 0.0

    matched_items: list[SkillMatchItem] = []
    gap_skills: list[str] = []
    score_accumulator = 0.0

    for skill in extracted_skills:
        # Search store records for chunk evidence
        evidence_chunk_ids: list[str] = []
        skill_clean = skill.lower()

        for record in store.records:
            record_text = (
                f"{record.title} {record.text} {' '.join(record.tags)}".lower()
            )
            # Check if skill pattern matches record
            patterns = SKILL_TAXONOMY.get(
                skill, [r"\b" + re.escape(skill_clean) + r"\b"]
            )
            if any(re.search(pat, record_text) for pat in patterns):
                evidence_chunk_ids.append(record.id)

        if skill in KNOWN_PORTFOLIO_SKILLS:
            meta = KNOWN_PORTFOLIO_SKILLS[skill]
            status = meta["status"]  # "matched" or "partial"
            proficiency = meta["proficiency"]
            weight = 1.0 if status == "matched" else 0.5
            score_accumulator += weight

            notes = f"Demonstrated in {len(evidence_chunk_ids)} portfolio chunks."
            matched_items.append(
                SkillMatchItem(
                    skill=skill,
                    proficiency=proficiency,
                    status=status,  # type: ignore[arg-type]
                    evidence_chunk_ids=evidence_chunk_ids[:5],
                    notes=notes,
                )
            )
        elif evidence_chunk_ids:
            # Found in portfolio records even if not in hardcoded dict
            status = "matched" if len(evidence_chunk_ids) >= 2 else "partial"
            proficiency = "Proficient" if status == "matched" else "Familiar"
            weight = 1.0 if status == "matched" else 0.5
            score_accumulator += weight

            notes = f"Identified in {len(evidence_chunk_ids)} portfolio records."
            matched_items.append(
                SkillMatchItem(
                    skill=skill,
                    proficiency=proficiency,
                    status=status,
                    evidence_chunk_ids=evidence_chunk_ids[:5],
                    notes=notes,
                )
            )
        else:
            # Skill not present in portfolio
            gap_skills.append(skill)
            matched_items.append(
                SkillMatchItem(
                    skill=skill,
                    proficiency="None",
                    status="gap",
                    evidence_chunk_ids=[],
                    notes="Not mentioned in current portfolio index.",
                )
            )

    match_score = round(score_accumulator / len(extracted_skills), 3)
    return matched_items, gap_skills, match_score
