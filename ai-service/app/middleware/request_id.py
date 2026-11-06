"""Request ID propagation and correlation context."""

from __future__ import annotations

import re
import uuid
from contextvars import ContextVar
from typing import Final

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_CTX_KEY: Final[str] = "request_id"
request_id_ctx_var: ContextVar[str] = ContextVar(REQUEST_ID_CTX_KEY, default="")

# Accept only strict ASCII alphanumeric characters, hyphens, and underscores (1 to 64 chars)
_REQUEST_ID_REGEX: Final[re.Pattern[str]] = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def is_valid_request_id(request_id: str | None) -> bool:
    """Validate that request_id contains only safe ASCII characters up to 64 chars.

    Rejects None, empty strings, Unicode, control characters, CRLF, spaces, and strings > 64 chars.
    """
    if not request_id or not isinstance(request_id, str):
        return False
    return bool(_REQUEST_ID_REGEX.fullmatch(request_id.strip()))


def generate_request_id() -> str:
    """Generate a safe, unique UUIDv4 request ID."""
    return str(uuid.uuid4())


def get_current_request_id() -> str:
    """Retrieve the current request ID from context."""
    val = request_id_ctx_var.get()
    return val if val else "system"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Ensure every HTTP request has an X-Request-ID attached and propagated."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        raw_id = request.headers.get("X-Request-ID")
        if is_valid_request_id(raw_id):
            req_id = raw_id.strip()  # type: ignore[union-attr]
        else:
            req_id = generate_request_id()

        token = request_id_ctx_var.set(req_id)
        request.state.request_id = req_id

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx_var.reset(token)
