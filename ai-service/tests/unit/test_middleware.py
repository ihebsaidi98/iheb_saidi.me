"""Unit tests for middleware behaviors."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_id_generated_when_missing(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) > 10


@pytest.mark.asyncio
async def test_request_id_preserved_when_provided(client: AsyncClient) -> None:
    custom_id = "custom-test-trace-id-1234"
    response = await client.get("/health/live", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_id


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


@pytest.mark.asyncio
async def test_payload_size_limit_rejection(client: AsyncClient) -> None:
    # Test settings configure max_request_size_bytes=1024
    oversized_data = "x" * 2048
    response = await client.post(
        "/v1/info",
        headers={
            "X-Internal-Token": "valid-test-internal-token",
            "Content-Length": str(len(oversized_data)),
        },
        content=oversized_data,
    )
    assert response.status_code == 413
    data = response.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert "exceeds maximum allowed size" in data["error"]["message"]


@pytest.mark.asyncio
async def test_payload_size_limit_without_content_length(
    client: AsyncClient,
) -> None:
    request_id = "payload-limit-test-123"

    async def body_stream():
        yield b"x" * 600
        yield b"y" * 600

    response = await client.post(
        "/v1/info",
        headers={
            "X-Internal-Token": "valid-test-internal-token",
            "X-Request-ID": request_id,
        },
        content=body_stream(),
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert response.headers.get("X-Request-ID") == request_id
    assert response.json()["error"]["request_id"] == request_id
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


@pytest.mark.asyncio
async def test_payload_size_limit_when_content_length_is_too_small(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/v1/info",
        headers={
            "X-Internal-Token": "valid-test-internal-token",
            "Content-Length": "10",
        },
        content=b"x" * 2048,
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


@pytest.mark.asyncio
async def test_payload_size_limit_rejects_single_oversized_chunk(
    client: AsyncClient,
) -> None:
    async def body_stream():
        yield b"x" * 4096

    response = await client.post(
        "/v1/info",
        headers={"X-Internal-Token": "valid-test-internal-token"},
        content=body_stream(),
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


# ---------------------------------------------------------------------------
# Request ID hardening: strict validation, malicious inputs, edge cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_request_id_unicode_is_replaced(client: AsyncClient) -> None:
    """Non-ASCII bytes in X-Request-ID are rejected at the HTTP layer.

    httpx enforces ASCII encoding for header string values.  A realistic
    attacker would send raw bytes through a TCP connection, not through a
    compliant HTTP client.  We verify that any ID not matching our strict
    regex is replaced by testing a known-invalid ASCII string that still
    encodes but fails the regex (e.g. contains a space).
    """
    # Simulate a header that looks "almost valid" but contains a space,
    # which is rejected by the regex ^[A-Za-z0-9_-]{1,64}$.
    response = await client.get(
        "/health/live", headers={"X-Request-ID": "invalid id with spaces"}
    )
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    # Must be replaced — cannot contain spaces
    assert " " not in req_id
    assert req_id != "invalid id with spaces"


@pytest.mark.asyncio
async def test_request_id_crlf_injection_is_replaced(client: AsyncClient) -> None:
    """CRLF injection via X-Request-ID is blocked at multiple layers.

    httpx (and all compliant HTTP clients) reject CRLF sequences in header
    values with a ValueError before the request even reaches the ASGI app.
    Low-level CRLF bypass is already covered in test_request_size_asgi.py
    via raw ASGI scope manipulation.

    This test verifies that a tab character (a legal-but-regex-failing ASCII
    value) is correctly rejected and replaced at the application layer.
    """
    response = await client.get(
        "/health/live", headers={"X-Request-ID": "inject\ttab-char"}
    )
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    # Tab is not in [A-Za-z0-9_-], so the ID must be replaced
    assert "\t" not in req_id
    assert req_id != "inject\ttab-char"


@pytest.mark.asyncio
async def test_request_id_too_long_is_replaced(client: AsyncClient) -> None:
    """Values longer than 64 characters must be silently dropped and a UUID generated."""
    too_long = "a" * 200
    response = await client.get("/health/live", headers={"X-Request-ID": too_long})
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert req_id != too_long
    assert len(req_id) <= 64


@pytest.mark.asyncio
async def test_request_id_spaces_are_replaced(client: AsyncClient) -> None:
    """Spaces and tab characters must be rejected and a fresh UUID generated."""
    response = await client.get(
        "/health/live", headers={"X-Request-ID": "has space inside"}
    )
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert " " not in req_id


@pytest.mark.asyncio
async def test_request_id_special_chars_are_replaced(client: AsyncClient) -> None:
    """Special shell/HTML injection characters must be stripped → new UUID generated."""
    for bad_value in ["<script>", "../etc/passwd", "$(evil)", "id%3Bcat+/etc/passwd"]:
        response = await client.get("/health/live", headers={"X-Request-ID": bad_value})
        assert response.status_code == 200
        req_id = response.headers.get("X-Request-ID")
        assert req_id is not None
        assert bad_value not in req_id
        assert "<" not in req_id
        assert ">" not in req_id


@pytest.mark.asyncio
async def test_request_id_valid_formats_are_accepted(client: AsyncClient) -> None:
    """Valid ASCII formats (UUID, short ID, underscores, hyphens) must be accepted."""
    for valid_id in [
        "abc-123",
        "trace_id_abc123",
        "a" * 64,
        "A1B2-C3D4-E5F6",
    ]:
        response = await client.get("/health/live", headers={"X-Request-ID": valid_id})
        assert response.status_code == 200
        assert response.headers.get("X-Request-ID") == valid_id


@pytest.mark.asyncio
async def test_request_id_null_byte_is_replaced(client: AsyncClient) -> None:
    """Control characters in header values are rejected by the regex.

    Actual null bytes (\x00) in HTTP headers are rejected by httpx (and
    real HTTP clients) before they reach ASGI.  We instead test that a
    percent-encoded null '%00' — which IS a valid ASCII sequence but fails
    the strict ^[A-Za-z0-9_-]{1,64}$ regex — is silently replaced.
    """
    response = await client.get(
        "/health/live", headers={"X-Request-ID": "valid%00null"}
    )
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    # Percent-encoded null must NOT pass through
    assert "%00" not in req_id
    assert req_id != "valid%00null"


# ---------------------------------------------------------------------------
# Security headers: verified across all response types
# ---------------------------------------------------------------------------

REQUIRED_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


@pytest.mark.asyncio
async def test_security_headers_on_successful_response(client: AsyncClient) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    for hdr, val in REQUIRED_SECURITY_HEADERS.items():
        assert response.headers.get(hdr) == val, f"Missing or wrong: {hdr}"


@pytest.mark.asyncio
async def test_security_headers_on_404_response(client: AsyncClient) -> None:
    response = await client.get(
        "/v1/nonexistent-route-xyz",
        headers={"X-Internal-Token": "valid-test-internal-token"},
    )
    assert response.status_code == 404
    for hdr, val in REQUIRED_SECURITY_HEADERS.items():
        assert response.headers.get(hdr) == val, f"Missing on 404: {hdr}"


@pytest.mark.asyncio
async def test_security_headers_on_422_validation_error(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/rag/search",
        json={"query": ""},  # empty query → validation error
        headers={"X-Internal-Token": "valid-test-internal-token"},
    )
    assert response.status_code == 422
    for hdr, val in REQUIRED_SECURITY_HEADERS.items():
        assert response.headers.get(hdr) == val, f"Missing on 422: {hdr}"


@pytest.mark.asyncio
async def test_security_headers_on_413_response(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/rag/search",
        content=b"x" * 4096,
        headers={
            "X-Internal-Token": "valid-test-internal-token",
            "Content-Length": "4096",
        },
    )
    assert response.status_code == 413
    for hdr, val in REQUIRED_SECURITY_HEADERS.items():
        assert response.headers.get(hdr) == val, f"Missing on 413: {hdr}"


@pytest.mark.asyncio
async def test_no_duplicate_security_headers(client: AsyncClient) -> None:
    """Security headers must not appear more than once in any response."""
    response = await client.get("/health/live")
    for hdr in REQUIRED_SECURITY_HEADERS:
        occurrences = [
            v for k, v in response.headers.items() if k.lower() == hdr.lower()
        ]
        assert len(occurrences) == 1, f"Duplicate header: {hdr} ({occurrences})"


@pytest.mark.asyncio
async def test_request_id_present_on_413_response(client: AsyncClient) -> None:
    """413 responses must include a consistent X-Request-ID in header and body."""
    request_id = "trace-413-security-audit"
    response = await client.post(
        "/v1/rag/search",
        content=b"x" * 4096,
        headers={
            "X-Internal-Token": "valid-test-internal-token",
            "Content-Length": "4096",
            "X-Request-ID": request_id,
        },
    )
    assert response.status_code == 413
    assert response.headers.get("X-Request-ID") == request_id
    body = response.json()
    assert body["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert body["error"]["request_id"] == request_id
