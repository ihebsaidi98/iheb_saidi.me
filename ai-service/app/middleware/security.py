"""Security middleware enforcing payload limits and security headers."""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforce standard security headers on all responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject request bodies exceeding the configured maximum size in bytes."""

    def __init__(self, app, max_size_bytes: int):  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.max_size_bytes = max_size_bytes

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > self.max_size_bytes:
                    req_id = getattr(request.state, "request_id", "unknown")
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": {
                                "code": "PAYLOAD_TOO_LARGE",
                                "message": f"Request body exceeds maximum allowed size of {self.max_size_bytes} bytes.",
                                "request_id": req_id,
                            }
                        },
                    )
            except ValueError:
                pass

        return await call_next(request)
