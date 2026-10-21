"""Pydantic schemas for RAG search and chat endpoints."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class SearchRequest(BaseModel):
    """Payload for POST /v1/rag/search."""

    model_config = ConfigDict(extra="forbid")

    query: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Search query string",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of search results to return",
    )
    threshold: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score threshold",
    )


class SearchResultItem(BaseModel):
    """Individual retrieved knowledge chunk in search results."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    document_id: str = Field(..., alias="documentId")
    source: str
    type: str
    title: str
    summary: str
    text: str
    score: float
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Response payload for POST /v1/rag/search."""

    query: str
    results: list[SearchResultItem]
    total: int
    index_version: str


class ChatMessage(BaseModel):
    """Conversation history turn."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=1000)


class ChatRequest(BaseModel):
    """Payload for POST /v1/rag/chat."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="User question to answer using grounded portfolio RAG",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of context chunks to retrieve",
    )
    threshold: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Cosine similarity threshold for relevance",
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=10,
        description="Recent conversation turns (at most 10)",
    )


class ChatSource(BaseModel):
    """Deduplicated source document returned in chat response."""

    id: str
    title: str
    type: str


class ChatResponse(BaseModel):
    """Exact chat response contract matching Next.js portfolio chatbot."""

    reply: str
    sources: list[ChatSource]
