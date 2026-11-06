"""Google GenAI client wrapper and factory."""

import logging
from typing import Any

from google import genai
from google.genai import types

from app.config import Settings

logger = logging.getLogger("ai_service.gemini")

_client_instance: Any = None


def get_gemini_client(settings: Settings) -> Any:
    """Return or initialize Google GenAI client instance.

    Allows test suites to pre-set or mock _client_instance.
    """
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    api_key = settings.gemini_api_key.get_secret_value()
    if not api_key:
        logger.warning(
            "GEMINI_API_KEY is not configured. GenAI calls will fail until configured."
        )
        return None

    # `HttpOptions.timeout` is in MILLISECONDS (google-genai divides it by 1000
    # before handing it to httpx), so mirror the per-request budget used by
    # `asyncio.wait_for`. `wait_for` only stops *awaiting* the worker thread and
    # leaves the HTTP request running; this bounds the socket itself.
    timeout_ms = max(1, int(settings.request_timeout_seconds * 1000))
    _client_instance = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=timeout_ms),
    )
    return _client_instance


def set_gemini_client(client: Any) -> None:
    """Explicitly inject a mock or custom GenAI client (used in testing)."""
    global _client_instance
    _client_instance = client


def reset_gemini_client() -> None:
    """Reset the client instance singleton."""
    global _client_instance
    _client_instance = None
