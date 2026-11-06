"""Typed intent router for Agentic RAG."""

import logging
import re
from typing import Any

from app.agent.schemas import IntentType
from app.config import Settings

logger = logging.getLogger("ai_service.agent.router")

# Definitive out-of-scope patterns that have zero connection to portfolio knowledge
OUT_OF_SCOPE_PATTERNS = [
    r"\b(recipe|bake|cook|bread|cake|ingredients?|soup|pasta)\b",
    r"\b(weather|temperature|forecast|rain|snow|climate)\b",
    r"\b(capital of|population of|currency of|president of|prime minister)\b",
    r"\b(world cup|football match|fifa|olympics|nba|champions league)\b",
    r"\b(quantum (computing|physics|mechanics|gravity|theory)|string theory|astronomy|solar system|mars|jupiter)\b",
    r"\b((write|tell)( me)? a (poem|song|story|joke|essay|riddle)|sing a song|lyrics)\b",
    r"\b(solve this (math|equation|integral|derivative))\b",
    r"\b(translate (this|to french|to spanish|to arabic))\b",
    r"\b(ignore (all )?previous instructions|jailbreak|dan mode|reveal (system|prompt))\b",
]

# Career advice patterns
CAREER_ADVICE_PATTERNS = [
    r"\b(career (advice|guidance|recommendation|path|trajectory))\b",
    r"\b(how (should|can|do|could) i (prepare|learn|start|transition|grow|become))\b",
    r"\b(what (should|can|could) i (learn|focus on|study|choose|prioritize))\b",
    r"\b(would you recommend|give me (advice|tips|suggestions))\b",
    r"\b(interview tips|career tips|advice for a (junior|senior|developer|engineer))\b",
]

# Multi-part indicators
MULTI_PART_INDICATORS = [
    r"\bcompare\b.+\b(and|with|to)\b",
    r"\bdifference between\b.+\band\b",
    r"\bboth\b.+\band\b",
    r"\bas well as\b",
    r"\b(vs\.?|versus)\b",
    r"\band (also|what about|how about)\b",
]

PORTFOLIO_TOPIC_GROUPS = [
    {"backend", "spring boot", "java", "api", "database", "postgres", "sql"},
    {"frontend", "react", r"next\.?js", "angular", "typescript", "tailwind"},
    {"ai", "llm", "rag", "embeddings", "gemini", "agent"},
    {"experience", "work", "novatek", "tunisair", "agroretail", "xtensus", "job"},
    {r"projects?", "saas", "platform", "chatbot", "auction"},
    {"education", "degree", "esprit", "isims", "university"},
]


def classify_intent_rules(query: str) -> IntentType:
    """Classify user query intent deterministically using structured patterns."""
    q = query.strip().lower()

    # 1. Out of scope check
    for pattern in OUT_OF_SCOPE_PATTERNS:
        if re.search(pattern, q):
            return "out_of_scope"

    # 2. Career advice check
    for pattern in CAREER_ADVICE_PATTERNS:
        if re.search(pattern, q):
            return "career_advice"

    # 3. Multi-part indicators check
    for pattern in MULTI_PART_INDICATORS:
        if re.search(pattern, q):
            return "multi_part"

    # 4. Check for multiple sentences / question marks
    question_count = q.count("?")
    if question_count >= 2:
        return "multi_part"

    # 5. Check if query joins two distinct topic clusters with "and"
    if " and " in q:
        matched_groups = 0
        for group in PORTFOLIO_TOPIC_GROUPS:
            if any(re.search(r"\b" + kw + r"\b", q) for kw in group):
                matched_groups += 1
        if matched_groups >= 2:
            return "multi_part"

    # Default to standard portfolio factual retrieval
    return "portfolio_factual"


def route_intent(
    query: str,
    client: Any = None,
    settings: Settings | None = None,
) -> IntentType:
    """Route query to its appropriate execution intent.

    Uses deterministic classification by default.
    """
    intent = classify_intent_rules(query)
    logger.debug("Routed query to intent: %s", intent)
    return intent
