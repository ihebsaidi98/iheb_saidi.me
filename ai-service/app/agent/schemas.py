"""Pydantic schemas for the Agentic RAG orchestration layer."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.rag.schemas import ChatSource

IntentType = Literal[
    "portfolio_factual",
    "multi_part",
    "career_advice",
    "out_of_scope",
]


class AgentAnswerRequest(BaseModel):
    """Payload for POST /v1/agent/answer."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="User query to process with Agentic RAG orchestration",
    )
    max_subqueries: int = Field(
        default=3,
        ge=1,
        le=3,
        description="Maximum number of subqueries to decompose into (capped at 3)",
    )
    retrieval_limit: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum context chunks to retrieve per subquery",
    )
    threshold: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Cosine similarity relevance threshold",
    )


class AgentMetadata(BaseModel):
    """Execution metadata returned with the Agentic RAG response."""

    intent: IntentType
    subqueries: list[str]
    subqueries_count: int
    retrieval_count: int
    abstained: bool
    execution_time_ms: float


class AgentAnswerResponse(BaseModel):
    """Structured response for POST /v1/agent/answer."""

    reply: str
    sources: list[ChatSource]
    metadata: AgentMetadata
