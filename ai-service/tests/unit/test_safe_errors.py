"""Unit tests for safe error messages and secret redaction."""

import io
import traceback

from app.core.safe_errors import (
    clear_registered_secrets,
    exc_info_for_log,
    format_validation_errors,
    redact_secrets,
    register_secret,
)

INTERNAL_SECRET_SENTINEL = "INTERNAL_SECRET_SENTINEL"
GEMINI_API_KEY_SENTINEL = "GEMINI_API_KEY_SENTINEL"
USER_PROMPT_SENTINEL = "USER_PROMPT_SENTINEL"


class MultiArgError(Exception):
    """Custom exception requiring multiple constructor arguments."""

    def __init__(self, code: int, detail: str) -> None:
        super().__init__(f"Error {code}: {detail}")
        self.code = code
        self.detail = detail


def test_redact_secrets_query_key_param() -> None:
    raw = "Error at https://example.com?key=AIzaSySecret12345"
    redacted = redact_secrets(raw)
    assert "AIzaSySecret12345" not in redacted
    assert "key=[REDACTED]" in redacted


def test_redact_secrets_bearer_token() -> None:
    raw = "Unauthorized Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload"
    redacted = redact_secrets(raw)
    assert "eyJhbGciOi" not in redacted
    assert "Bearer [REDACTED]" in redacted


def test_redact_secrets_env_style_assignment() -> None:
    raw = "Config failed GEMINI_API_KEY=GEMINI_API_KEY_SENTINEL value"
    redacted = redact_secrets(raw)
    assert "GEMINI_API_KEY_SENTINEL" not in redacted
    assert "[REDACTED]" in redacted


def test_redact_secrets_registered_secret() -> None:
    custom_secret = "super-secret-vault-token-998877"
    register_secret(custom_secret)
    try:
        raw = f"Vault error: {custom_secret} failed to authenticate"
        redacted = redact_secrets(raw)
        assert custom_secret not in redacted
        assert "[REDACTED]" in redacted
    finally:
        clear_registered_secrets()


def test_redact_secrets_sentinels() -> None:
    raw = f"Failure: {INTERNAL_SECRET_SENTINEL} and {GEMINI_API_KEY_SENTINEL}"
    redacted = redact_secrets(raw)
    assert INTERNAL_SECRET_SENTINEL not in redacted
    assert GEMINI_API_KEY_SENTINEL not in redacted
    assert "[REDACTED]" in redacted


def test_exc_info_for_log_redacts_exception_message() -> None:
    exc = RuntimeError("Provider failure GEMINI_API_KEY=GEMINI_API_KEY_SENTINEL")
    _, sanitized, _ = exc_info_for_log(exc)
    assert "GEMINI_API_KEY_SENTINEL" not in str(sanitized)


def test_exc_info_for_log_multi_arg_exception() -> None:
    secret = GEMINI_API_KEY_SENTINEL
    exc = MultiArgError(403, f"Upstream rejected token={secret}")
    _, sanitized, _ = exc_info_for_log(exc)
    sanitized_str = str(sanitized)
    assert GEMINI_API_KEY_SENTINEL not in sanitized_str
    assert "token=[REDACTED]" in sanitized_str
    # Original class name is preserved on the sanitized proxy
    assert type(sanitized).__name__ == "MultiArgError"


def test_exc_info_for_log_chained_cause_redaction() -> None:
    inner_secret = INTERNAL_SECRET_SENTINEL
    outer_secret = GEMINI_API_KEY_SENTINEL
    try:
        try:
            raise MultiArgError(401, f"Low-level key={inner_secret}")
        except Exception as inner:
            raise RuntimeError(f"High-level wrapper token={outer_secret}") from inner
    except Exception as outer:
        ei = exc_info_for_log(outer)
        sio = io.StringIO()
        traceback.print_exception(*ei, file=sio)
        log_text = sio.getvalue()

        # Both inner and outer secrets must be stripped from formatted traceback
        assert inner_secret not in log_text
        assert outer_secret not in log_text
        assert "key=[REDACTED]" in log_text
        assert "token=[REDACTED]" in log_text
        assert "MultiArgError:" in log_text
        assert "RuntimeError:" in log_text


def test_exc_info_for_log_chained_context_redaction() -> None:
    inner_secret = INTERNAL_SECRET_SENTINEL
    try:
        try:
            raise ValueError(f"Initial error authorization={inner_secret}")
        except Exception:
            raise RuntimeError("Handler crash during recovery")  # noqa: B904
    except Exception as outer:
        ei = exc_info_for_log(outer)
        sio = io.StringIO()
        traceback.print_exception(*ei, file=sio)
        log_text = sio.getvalue()

        assert inner_secret not in log_text
        assert "authorization=[REDACTED]" in log_text


def test_exc_info_for_log_cycle_handling() -> None:
    e1 = RuntimeError("Cycle one")
    e2 = RuntimeError("Cycle two")
    e1.__cause__ = e2
    e2.__cause__ = e1

    _, sanitized, _ = exc_info_for_log(e1)
    assert sanitized is not None


def test_format_validation_errors_no_user_input_echo() -> None:
    sensitive_input = "SUPER_SECRET_USER_INPUT_SENTINEL"
    raw_errors = [
        {
            "type": "string_too_short",
            "loc": ("body", "message"),
            "msg": f"String should have at least 1 character, got {sensitive_input}",
            "input": sensitive_input,
            "ctx": {"min_length": 1},
        },
        {
            "type": "greater_than",
            "loc": ("body", "limit"),
            "msg": f"Input should be less than or equal to 20, got {sensitive_input}",
            "input": sensitive_input,
        },
    ]

    result = format_validation_errors(raw_errors)
    assert sensitive_input not in result
    assert "message: Value too short" in result
    assert "limit: Value out of range" in result


def test_format_validation_errors_redacts_sensitive_field_names() -> None:
    raw_errors = [
        {
            "type": "extra_forbidden",
            "loc": ("body", f"extra_{INTERNAL_SECRET_SENTINEL}"),
            "msg": "Extra inputs are not permitted",
        }
    ]

    result = format_validation_errors(raw_errors)
    assert INTERNAL_SECRET_SENTINEL not in result
    assert "[REDACTED]" in result or "extra_" in result
    assert "Extra fields not allowed" in result


def test_format_validation_errors_bounds_excessive_field_length() -> None:
    oversized_field = "a" * 200
    raw_errors = [
        {
            "type": "missing",
            "loc": ("body", oversized_field),
            "msg": "Field required",
        }
    ]

    result = format_validation_errors(raw_errors)
    assert len(result) < 150
    assert "..." in result
    assert "Field required" in result
