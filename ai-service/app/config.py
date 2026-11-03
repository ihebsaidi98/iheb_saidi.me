"""Configuration management using Pydantic Settings."""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("ai_service.config")

# H2: no development token is shipped as a default.  AI_SERVICE_TOKEN must be
# configured explicitly on both sides (Next.js and this service).
_MIN_TOKEN_LENGTH = 32


class Settings(BaseSettings):
    """Application settings with environment-variable overrides."""

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core Environment
    environment: Literal["development", "test", "staging", "production"] = "development"
    host: str = "127.0.0.1"
    port: int = 8001
    log_level: str = "INFO"

    # Security & Internal Authentication
    ai_service_token: SecretStr = Field(
        default=SecretStr(""),
        description=(
            "Internal shared secret for server-to-server Next.js proxy calls. "
            "Must be set explicitly (>=32 chars); production/staging refuse to start "
            "without it and internal endpoints stay closed until it is configured."
        ),
    )
    allowed_origins: Annotated[
        list[str],
        Field(
            default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
        ),
    ]

    # Request Bounds & Safety
    request_timeout_seconds: float = Field(default=15.0, ge=1.0, le=60.0)
    max_request_size_bytes: int = Field(
        default=1_048_576, ge=1024, le=10_485_760
    )  # 1MB default

    # Google Gemini Configuration
    gemini_api_key: SecretStr = Field(
        default=SecretStr(""),
        description="Google Gemini API key for server-side generation & embeddings",
    )
    gemini_chat_model: str = Field(default="gemini-3.5-flash-lite")
    gemini_embedding_model: str = Field(default="gemini-embedding-001")
    gemini_embedding_dimensions: int = Field(default=768)

    # RAG Vector Store & Retrieval Configuration
    rag_index_path: Path | None = Field(
        default=None,
        description="Explicit path to rag-index.json. If None, auto-resolved from repo root.",
    )
    default_search_limit: int = Field(default=5, ge=1, le=20)
    max_search_limit: int = Field(default=20, ge=1, le=100)
    default_search_threshold: float = Field(default=0.35, ge=0.0, le=1.0)

    # Agentic RAG Configuration (Phase 3)
    agentic_rag_enabled: bool = Field(
        default=True,
        description="Feature flag to enable or disable the Agentic RAG orchestration endpoint",
    )
    agent_max_subqueries: int = Field(default=3, ge=1, le=5)
    agent_max_retrieval_calls: int = Field(default=6, ge=1, le=10)
    agent_max_context_chunks: int = Field(default=10, ge=1, le=20)

    # Career Copilot Configuration (Phase 3 Stage 2)
    career_copilot_enabled: bool = Field(
        default=True,
        description="Feature flag to enable or disable Career Copilot endpoints",
    )

    # Adaptive Interview Simulator Configuration (Phase 3 Stage 3)
    interview_simulator_enabled: bool = Field(
        default=True,
        description="Feature flag to enable or disable Adaptive Interview Simulator endpoints",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> list[str]:
        if isinstance(v, str):
            # Support comma-separated strings from environment variables
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("allowed_origins", mode="after")
    @classmethod
    def reject_wildcard_origins(cls, v: list[str]) -> list[str]:
        """Reject wildcard '*' in allowed_origins.

        The combination allow_origins=['*'] + allow_credentials=True is forbidden
        by the CORS specification and causes Starlette to raise a runtime error.
        Fail at configuration time with a clear message instead.
        """
        if "*" in v:
            raise ValueError(
                "Wildcard '*' is not permitted in allowed_origins when "
                "allow_credentials=True.  Specify explicit origin URLs."
            )
        return v

    @model_validator(mode="after")
    def warn_on_missing_or_weak_token_outside_test(self) -> "Settings":
        """WARN when AI_SERVICE_TOKEN is missing or weak outside a test context.

        There is no fallback token: an unset value stays empty.  Production and
        staging refuse to start in that case (see app.main.lifespan), while a
        development instance keeps running but rejects every internal call.  The
        warning never includes the token value itself.
        """
        if self.environment not in ("test",):
            token = self.ai_service_token.get_secret_value()
            if not token:
                logger.warning(
                    "AI_SERVICE_TOKEN is not configured.  Internal server-to-server "
                    "calls will be rejected.  Set the same strong secret (>=32 chars) "
                    "in Next.js and the AI service before enabling AI features."
                )
            elif len(token) < _MIN_TOKEN_LENGTH:
                logger.warning(
                    "AI_SERVICE_TOKEN is shorter than %d characters and will be "
                    "refused in production/staging.  Generate one with "
                    "`openssl rand -hex 32` or scripts/setup-env.py.",
                    _MIN_TOKEN_LENGTH,
                )
        return self

    def is_production(self) -> bool:
        return self.environment == "production"

    def is_test(self) -> bool:
        return self.environment == "test"

    def is_docs_enabled(self) -> bool:
        return self.environment not in ("staging", "production")


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
