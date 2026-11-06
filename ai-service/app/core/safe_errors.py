"""Public API error messages, exception sanitization, and server-side log redaction."""

from __future__ import annotations

import logging
import re
from typing import Any

# --- Client-safe messages (HTTP responses) ---

PUBLIC_SERVICE_UNAVAILABLE = (
    "AI service is temporarily unavailable. Please try again later."
)
PUBLIC_GENERATION_FAILED = "Failed to generate a response. Please try again later."
PUBLIC_RAG_RETRIEVAL_FAILED = "Failed to retrieve portfolio context."
PUBLIC_RAG_CHAT_FAILED = "Failed to generate chat response."
PUBLIC_AGENT_FAILED = "Failed to complete Agentic RAG request."
PUBLIC_VALIDATION_FAILED = "Request validation failed."

# --- Credential & Secret Redaction Patterns ---

_RE_KEY_PARAM = re.compile(
    r"(?i)\b(key|api_key|token|access_token)=[^&\s'\"]+", re.IGNORECASE
)
_RE_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+", re.IGNORECASE)
_RE_GOOGLE_API_KEY = re.compile(r"\bAIza[0-9A-Za-z_-]{10,}\b")
_RE_ENV_SECRET = re.compile(
    r"(?i)\b(gemini_api_key|ai_service_token|authorization|x-internal-token|internal_secret|api_key|secret_key|client_secret|password|credential|token)\s*[:=]\s*['\"]?[^\s,'\"]+"
)
_RE_SENTINELS = re.compile(
    r"(?i)\b[a-z0-9_-]*(?:secret|api_key|token|password|credential)[a-z0-9_-]*sentinel\b"
)

_REGISTERED_SECRETS: set[str] = set()


def register_secret(secret: str | None) -> None:
    """Register a runtime secret string to be redacted from logs and exceptions."""
    if secret:
        cleaned = secret.strip()
        if len(cleaned) >= 4:
            _REGISTERED_SECRETS.add(cleaned)


def clear_registered_secrets() -> None:
    """Clear all registered runtime secrets (useful for tests)."""
    _REGISTERED_SECRETS.clear()


def redact_secrets(message: str) -> str:
    """Redact credentials, tokens, sensitive env variables, and sentinels."""
    if not message:
        return message

    redacted = message

    # 1. Registered dynamic secrets (longest first to avoid partial replacements)
    if _REGISTERED_SECRETS:
        for secret in sorted(_REGISTERED_SECRETS, key=len, reverse=True):
            if secret in redacted:
                redacted = redacted.replace(secret, "[REDACTED]")

    # 2. Known credential and sentinel patterns
    redacted = _RE_KEY_PARAM.sub(r"\1=[REDACTED]", redacted)
    redacted = _RE_BEARER.sub("Bearer [REDACTED]", redacted)
    redacted = _RE_GOOGLE_API_KEY.sub("AIza[REDACTED]", redacted)
    redacted = _RE_ENV_SECRET.sub(r"\1=[REDACTED]", redacted)
    redacted = _RE_SENTINELS.sub("[REDACTED]", redacted)

    return redacted


# --- Client-Safe Validation Formatting (HTTP 422) ---

_VALIDATION_TYPE_MESSAGES: dict[str, str] = {
    "missing": "Field required",
    "string_type": "Invalid type",
    "string_too_short": "Value too short",
    "string_too_long": "Value too long",
    "string_pattern_mismatch": "Invalid format",
    "int_type": "Invalid type",
    "int_parsing": "Invalid type",
    "float_type": "Invalid type",
    "float_parsing": "Invalid type",
    "bool_type": "Invalid type",
    "bool_parsing": "Invalid type",
    "greater_than": "Value out of range",
    "less_than": "Value out of range",
    "greater_than_equal": "Value out of range",
    "less_than_equal": "Value out of range",
    "json_invalid": "Invalid JSON payload",
    "value_error": "Invalid value",
    "assertion_error": "Invalid value",
    "enum": "Invalid enum value",
    "literal_error": "Invalid literal value",
    "union_tag_invalid": "Invalid union tag",
    "union_tag_not_found": "Invalid union tag",
    "extra_forbidden": "Extra fields not allowed",
    "list_type": "Invalid type",
    "dict_type": "Invalid type",
    "set_type": "Invalid type",
    "model_type": "Invalid type",
    "dataclass_type": "Invalid type",
    "too_short": "Value too short",
    "too_long": "Value too long",
    "uuid_parsing": "Invalid format",
    "uuid_type": "Invalid format",
    "url_parsing": "Invalid format",
    "url_type": "Invalid format",
    "date_parsing": "Invalid date format",
    "datetime_parsing": "Invalid date format",
}

_SAFE_FIELD_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def _public_field_loc(loc: tuple[Any, ...] | list[Any]) -> str:
    """Sanitize and format field locations without echoing raw values or secrets."""
    parts: list[str] = []
    for item in loc:
        str_item = str(item)
        if str_item in {"body", "query", "header", "cookie", "path"}:
            continue
        # Pass field through secret redaction
        redacted_item = redact_secrets(str_item)
        # Bound length to prevent payload reflection
        if len(redacted_item) > 64:
            redacted_item = redacted_item[:64] + "..."
        if (
            not _SAFE_FIELD_NAME_RE.match(redacted_item)
            and "[REDACTED]" not in redacted_item
        ):
            redacted_item = "field"
        parts.append(redacted_item)
    return ".".join(parts) if parts else "request"


def format_validation_errors(errors: list[dict[str, Any]]) -> str:
    """Build a client-safe 422 message from Pydantic errors (no input echo)."""
    details: list[str] = []
    for err in errors:
        field = _public_field_loc(err.get("loc", ()))
        err_type = str(err.get("type", "validation_error"))
        msg = _VALIDATION_TYPE_MESSAGES.get(err_type, "Invalid field")
        details.append(f"{field}: {msg}")
    return "; ".join(details) if details else PUBLIC_VALIDATION_FAILED


# --- Robust Exception Sanitization & Safe Log Proxies ---


class SanitizedException(Exception):
    """Safe proxy exception ensuring a redacted string representation."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self._message = message

    def __str__(self) -> str:
        return self._message

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self._message!r})"


class SanitizedBaseException(BaseException):
    """Safe proxy base exception ensuring a redacted string representation."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self._message = message

    def __str__(self) -> str:
        return self._message

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self._message!r})"


_SANITIZED_CLASS_CACHE: dict[str, type[BaseException]] = {}


def _get_sanitized_class(orig_cls: type[BaseException]) -> type[BaseException]:
    name = orig_cls.__name__
    if name not in _SANITIZED_CLASS_CACHE:
        base = (
            SanitizedException
            if issubclass(orig_cls, Exception)
            else SanitizedBaseException
        )
        _SANITIZED_CLASS_CACHE[name] = type(
            name,
            (base,),
            {"__module__": getattr(orig_cls, "__module__", "builtins")},
        )
    return _SANITIZED_CLASS_CACHE[name]


def _sanitize_exception(exc: BaseException, seen: set[int]) -> BaseException:
    """Recursively sanitize an exception and its __cause__/__context__ chain."""
    exc_id = id(exc)
    if exc_id in seen:
        return exc
    seen.add(exc_id)

    redacted_msg = redact_secrets(str(exc))
    sanitized: BaseException
    try:
        candidate = type(exc)(redacted_msg)
        if str(candidate) == redacted_msg:
            sanitized = candidate
        else:
            cls = _get_sanitized_class(type(exc))
            sanitized = cls(redacted_msg)
    except Exception:
        cls = _get_sanitized_class(type(exc))
        sanitized = cls(redacted_msg)

    sanitized.__traceback__ = exc.__traceback__

    if exc.__cause__ is not None:
        sanitized.__cause__ = _sanitize_exception(exc.__cause__, seen)
    elif exc.__suppress_context__:
        sanitized.__cause__ = None

    if exc.__context__ is not None:
        if exc.__context__ is exc.__cause__:
            sanitized.__context__ = sanitized.__cause__
        else:
            sanitized.__context__ = _sanitize_exception(exc.__context__, seen)
    else:
        sanitized.__context__ = None

    # Crucial: set __suppress_context__ AFTER setting __cause__, because in Python
    # assigning __cause__ = None implicitly sets __suppress_context__ = True.
    sanitized.__suppress_context__ = exc.__suppress_context__

    return sanitized


def exc_info_for_log(
    exc: BaseException,
) -> tuple[type[BaseException], BaseException, Any]:
    """Build exc_info with redacted messages across the exception chain."""
    sanitized = _sanitize_exception(exc, set())
    return (type(sanitized), sanitized, sanitized.__traceback__)


def log_route_error(
    logger: logging.Logger,
    context: str,
    exc: BaseException,
) -> None:
    """Log a handled route failure with redacted message and traceback."""
    logger.error(
        "%s [%s]: %s",
        context,
        type(exc).__name__,
        redact_secrets(str(exc)),
        exc_info=exc_info_for_log(exc),
    )


def log_warning_redacted(
    logger: logging.Logger,
    template: str,
    exc: BaseException,
    *args: object,
) -> None:
    """Log a warning with optional prefix args and a redacted exception summary."""
    logger.warning(
        template,
        *args,
        type(exc).__name__,
        redact_secrets(str(exc)),
    )
