"""Request ID propagation and correlation context."""

import uuid
from contextvars import ContextVar
from typing import Final

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_CTX_KEY: Final[str] = "request_id"
request_id_ctx_var: ContextVar[str] = ContextVar(REQUEST_ID_CTX_KEY, default="")


def get_current_request_id() -> str:
    """Retrieve the current request ID from context."""
    val = request_id_ctx_var.get()
    return val if val else "system"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Ensure every HTTP request has an X-Request-ID attached and propagated."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Accept valid incoming request ID or generate a new UUIDv4
        req_id = request.headers.get("X-Request-ID")
        if not req_id or len(req_id.strip()) == 0 or len(req_id) > 64:
            req_id = str(uuid.uuid4())
        else:
            req_id = req_id.strip()

        token = request_id_ctx_var.set(req_id)
        request.state.request_id = req_id

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx_var.reset(token)
