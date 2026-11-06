"""Query decomposition for multi-part questions."""

import logging
import re
from typing import Any

logger = logging.getLogger("ai_service.agent.decomposition")


def decompose_query(
    query: str,
    max_subqueries: int = 3,
    client: Any = None,
) -> list[str]:
    """Decompose multi-part query into at most max_subqueries focused retrieval queries.

    Uses deterministic structural splitting with fallback to single original query.
    """
    clean_query = query.strip()
    effective_max = min(max_subqueries, 3)

    # 1. Multiple question marks: e.g. "What did he do at Tunisair? And what about Novatek?"
    if "?" in clean_query:
        parts = [p.strip() for p in clean_query.split("?") if p.strip()]
        if len(parts) >= 2:
            return parts[:effective_max]

    # 2. Compare / contrast pattern: e.g. "Compare Iheb's backend experience and his AI projects"
    compare_match = re.search(
        r"^(?:compare|contrast|what is the difference between)\s+(.+?)\s+(?:and|with|to)\s+(.+)$",
        clean_query,
        re.IGNORECASE,
    )
    if compare_match:
        part1 = compare_match.group(1).strip()
        part2 = compare_match.group(2).strip()
        if part1 and part2:
            return [part1, part2][:effective_max]

    # 3. Explicit conjunction separators: "as well as", "vs.", "versus", "additionally"
    for separator in [
        " as well as ",
        " vs. ",
        " vs ",
        " versus ",
        " additionally, ",
        " also, ",
    ]:
        if separator in clean_query.lower():
            pattern = re.compile(re.escape(separator), re.IGNORECASE)
            parts = [
                p.strip() for p in pattern.split(clean_query) if len(p.strip()) >= 5
            ]
            if len(parts) >= 2:
                return parts[:effective_max]

    # 4. "both X and Y" pattern
    both_match = re.search(
        r"\bboth\s+(.+?)\s+and\s+(.+)$",
        clean_query,
        re.IGNORECASE,
    )
    if both_match:
        part1 = both_match.group(1).strip()
        part2 = both_match.group(2).strip()
        if part1 and part2:
            return [part1, part2][:effective_max]

    # 5. Compound sentence with " and " where both sides are substantial clauses
    if " and " in clean_query.lower():
        parts = [
            p.strip() for p in re.split(r"\s+and\s+", clean_query, flags=re.IGNORECASE)
        ]
        # Filter parts that have sufficient length and context
        valid_parts = [p for p in parts if len(p) >= 10]
        if len(valid_parts) >= 2:
            return valid_parts[:effective_max]

    # Fallback to the original clean query
    return [clean_query]
