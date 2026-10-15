"""Unit tests for configuration validation and settings."""

from pydantic import SecretStr

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
