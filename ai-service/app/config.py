"""Configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        default=SecretStr("dev-internal-token-change-in-production"),
        description="Internal shared secret for server-to-server Next.js proxy calls",
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

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> list[str]:
        if isinstance(v, str):
            # Support comma-separated strings from environment variables
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    def is_production(self) -> bool:
        return self.environment == "production"

    def is_test(self) -> bool:
        return self.environment == "test"


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
