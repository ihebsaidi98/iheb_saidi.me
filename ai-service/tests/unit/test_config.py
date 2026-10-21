"""Unit tests for configuration validation and settings."""

import logging

import pytest
from pydantic import SecretStr, ValidationError

from app.config import Settings


def test_settings_defaults() -> None:
    settings = Settings()
    assert settings.environment == "development"
    assert settings.host == "127.0.0.1"
    assert settings.port == 8001
    assert settings.request_timeout_seconds == 15.0
    assert settings.max_request_size_bytes == 1_048_576


def test_settings_origins_parsing() -> None:
    # Comma-separated string parsing
    settings = Settings(allowed_origins="http://localhost:3000, https://portfolio.dev")  # type: ignore[arg-type]
    assert settings.allowed_origins == [
        "http://localhost:3000",
        "https://portfolio.dev",
    ]


def test_secrets_redacted_in_repr() -> None:
    settings = Settings(
        gemini_api_key=SecretStr("super-secret-key-1234"),
        ai_service_token=SecretStr("super-secret-internal-token"),
    )
    repr_str = repr(settings)
    assert "super-secret-key-1234" not in repr_str
    assert "super-secret-internal-token" not in repr_str
    assert "**********" in repr_str


def test_environment_helper_methods() -> None:
    dev_settings = Settings(environment="development")
    assert not dev_settings.is_production()
    assert not dev_settings.is_test()

    test_settings = Settings(environment="test")
    assert not test_settings.is_production()
    assert test_settings.is_test()

    prod_settings = Settings(environment="production")
    assert prod_settings.is_production()
    assert not prod_settings.is_test()


# ---------------------------------------------------------------------------
# CORS wildcard guard
# ---------------------------------------------------------------------------


def test_wildcard_in_allowed_origins_raises() -> None:
    """'*' in allowed_origins must raise ValidationError at construction time."""
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins=["*"],  # type: ignore[arg-type]
        )


def test_wildcard_string_in_allowed_origins_raises() -> None:
    """Comma-separated '*' must also be rejected after parsing."""
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins="*",  # type: ignore[arg-type]
        )


def test_mixed_wildcard_raises() -> None:
    """'*' mixed with valid origins must also be rejected."""
    with pytest.raises(ValidationError, match="Wildcard"):
        Settings(
            environment="test",
            allowed_origins=["http://localhost:3000", "*"],  # type: ignore[arg-type]
        )


def test_explicit_origins_accepted() -> None:
    """Non-wildcard explicit origins must not raise ValidationError."""
    s = Settings(
        environment="test",
        allowed_origins=["http://localhost:3000", "https://portfolio.dev"],  # type: ignore[arg-type]
        ai_service_token=SecretStr("a-strong-test-token-at-least-32chars"),
    )
    assert len(s.allowed_origins) == 2


# ---------------------------------------------------------------------------
# Default / weak token warning
# ---------------------------------------------------------------------------


def test_default_token_emits_warning_outside_test(caplog) -> None:
    """The default dev token must produce a WARNING when environment != 'test'."""
    with caplog.at_level(logging.WARNING, logger="ai_service.config"):
        Settings(environment="development", _env_file=None)  # uses default dev token
    assert any("AI_SERVICE_TOKEN" in r.message for r in caplog.records)


def test_default_token_no_warning_in_test_env(caplog) -> None:
    """The default dev token must NOT produce a WARNING in test environment."""
    with caplog.at_level(logging.WARNING, logger="ai_service.config"):
        Settings(environment="test", _env_file=None)
    assert not any("AI_SERVICE_TOKEN" in r.message for r in caplog.records)


def test_strong_token_no_warning_in_development(caplog) -> None:
    """A strong token must not trigger the weak-token warning."""
    with caplog.at_level(logging.WARNING, logger="ai_service.config"):
        Settings(
            environment="development",
            ai_service_token=SecretStr("a-long-and-strong-dev-token-at-least-32chars"),
        )
    assert not any("AI_SERVICE_TOKEN" in r.message for r in caplog.records)
