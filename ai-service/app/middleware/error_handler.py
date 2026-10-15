"""Structured exception handlers for the FastAPI application."""

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

from app.middleware.request_id import get_current_request_id

logger = logging.getLogger("ai_service.errors")


def register_exception_handlers(app: FastAPI) -> None:
    """Register uniform structured error handlers on the FastAPI app."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None) or get_current_request_id()

        code = "HTTP_ERROR"
        message = str(exc.detail)

        # Support structured detail dictionary if provided
        if isinstance(exc.detail, dict):
            detail_dict: dict[str, Any] = exc.detail
            code = str(detail_dict.get("code", code))
            message = str(detail_dict.get("message", message))
        elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "UNAUTHORIZED"
        elif exc.status_code == status.HTTP_403_FORBIDDEN:
            code = "FORBIDDEN"
        elif exc.status_code == status.HTTP_404_NOT_FOUND:
            code = "NOT_FOUND"
        elif exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            code = "RATE_LIMITED"

        headers = exc.headers or {}
        headers["X-Request-ID"] = req_id

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "request_id": req_id,
                }
            },
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None) or get_current_request_id()

        # Extract concise error messages without echoing unvalidated raw payloads
        details = []
        for err in exc.errors():
            loc = ".".join(str(item) for item in err.get("loc", []))
            msg = err.get("msg", "Invalid field")
            details.append(f"{loc}: {msg}" if loc else msg)

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "; ".join(details) or "Request validation failed.",
                    "request_id": req_id,
                }
            },
            headers={"X-Request-ID": req_id},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None) or get_current_request_id()

        # Log exception type and request ID, masking any user payload or credentials
        logger.error(
            "Unhandled server exception on %s %s [req_id=%s]: %s: %s",
            request.method,
            request.url.path,
            req_id,
            type(exc).__name__,
            str(exc),
            exc_info=True,
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An internal server error occurred. Please contact the administrator.",
                    "request_id": req_id,
                }
            },
            headers={"X-Request-ID": req_id},
        )
