"""FastAPI dependencies for security and settings."""

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


async def verify_internal_token(
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,  # type: ignore[assignment]
) -> str:
    """Verify incoming internal server-to-server token in constant time.

    Accepts token via 'X-Internal-Token' header or 'Authorization: Bearer <token>'.
    Rejects unauthorized requests immediately.
    """
    token_to_check: str | None = None

    if x_internal_token:
        token_to_check = x_internal_token.strip()
    elif authorization and authorization.startswith("Bearer "):
        token_to_check = authorization[7:].strip()

    expected_token = settings.ai_service_token.get_secret_value()

    if not token_to_check or not secrets.compare_digest(token_to_check, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid or missing internal service authentication token.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_to_check
