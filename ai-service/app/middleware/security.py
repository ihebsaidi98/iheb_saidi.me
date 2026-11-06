"""Security middleware enforcing payload limits and security headers."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.middleware.request_id import (
    generate_request_id,
    get_current_request_id,
    is_valid_request_id,
)

STANDARD_SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforce standard security headers on all HTTP responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        for header_name, header_value in STANDARD_SECURITY_HEADERS.items():
            response.headers[header_name] = header_value
        return response


class RequestSizeLimitMiddleware:
    """Enforce the actual HTTP request body size at the ASGI level.

    Guards against oversized payloads whether Content-Length is declared, absent,
    misreported, or streamed in chunks. Bounded in memory to never buffer beyond max_size_bytes.
    """

    def __init__(self, app: ASGIApp, max_size_bytes: int) -> None:
        if max_size_bytes <= 0:
            raise ValueError("max_size_bytes must be positive")

        self.app = app
        self.max_size_bytes = max_size_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers: dict[str, str] = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }

        def _resolve_request_id() -> str:
            # 1. State if set by outer RequestIdMiddleware
            state_id = scope.get("state", {}).get("request_id")
            if is_valid_request_id(state_id):
                return str(state_id)
            # 2. ContextVar
            ctx_id = get_current_request_id()
            if ctx_id and ctx_id != "system" and is_valid_request_id(ctx_id):
                return ctx_id
            # 3. Request header if valid
            header_id = headers.get("x-request-id")
            if is_valid_request_id(header_id):
                return str(header_id).strip()
            # 4. Safe fallback
            return generate_request_id()

        async def reject_request() -> None:
            request_id = _resolve_request_id()
            response_headers = {
                **STANDARD_SECURITY_HEADERS,
                "X-Request-ID": request_id,
            }
            response = JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "PAYLOAD_TOO_LARGE",
                        "message": (
                            "Request body exceeds maximum allowed size "
                            f"of {self.max_size_bytes} bytes."
                        ),
                        "request_id": request_id,
                    }
                },
                headers=response_headers,
            )
            await response(scope, receive, send)

        # 1. Fast-path check using Content-Length if present
        content_length_raw = headers.get("content-length")
        if content_length_raw is not None:
            try:
                content_length = int(content_length_raw.strip())
                if content_length > self.max_size_bytes or content_length < 0:
                    await reject_request()
                    return
            except ValueError:
                # Malformed / smuggling Content-Length header
                await reject_request()
                return

        # 2. Streaming check: count real body bytes incrementally
        messages: list[Message] = []
        total_size = 0

        while True:
            message = await receive()
            msg_type = message.get("type")

            if msg_type == "http.disconnect":
                return

            if msg_type != "http.request":
                # Preserve non-request ASGI events
                messages.append(message)
                continue

            chunk = message.get("body", b"")
            total_size += len(chunk)

            if total_size > self.max_size_bytes:
                # Reject immediately without buffering excess bytes in memory
                await reject_request()
                return

            messages.append(message)

            if not message.get("more_body", False):
                break

        # 3. Replay validated body chunks to downstream ASGI app
        index = 0

        async def replay_receive() -> Message:
            nonlocal index
            if index < len(messages):
                msg = messages[index]
                index += 1
                return msg
            return await receive()

        await self.app(scope, replay_receive, send)
