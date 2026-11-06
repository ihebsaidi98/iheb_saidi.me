"""Direct ASGI tests for request-size enforcement."""

import json

import pytest

from app.middleware.security import RequestSizeLimitMiddleware


@pytest.mark.asyncio
async def test_oversized_body_is_rejected_without_calling_app() -> None:
    app_called = False
    sent_messages = []
    body = b"x" * 4096
    receive_calls = 0

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True

    async def receive():
        nonlocal receive_calls
        receive_calls += 1
        if receive_calls == 1:
            return {
                "type": "http.request",
                "body": body,
                "more_body": False,
            }
        return {"type": "http.disconnect"}

    async def send(message):
        sent_messages.append(message)

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "method": "POST",
            "path": "/upload",
            "headers": [],
            "state": {"request_id": "asgi-size-test"},
        },
        receive,
        send,
    )

    assert app_called is False
    assert any(
        message["type"] == "http.response.start" and message["status"] == 413
        for message in sent_messages
    )


@pytest.mark.asyncio
async def test_negative_content_length_is_rejected() -> None:
    app_called = False
    sent_messages = []

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        sent_messages.append(message)

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "method": "POST",
            "path": "/test",
            "headers": [(b"content-length", b"-100")],
            "state": {"request_id": "test-neg-len"},
        },
        receive,
        send,
    )

    assert app_called is False
    assert any(
        message["type"] == "http.response.start" and message["status"] == 413
        for message in sent_messages
    )


@pytest.mark.asyncio
async def test_malformed_content_length_is_rejected() -> None:
    app_called = False
    sent_messages = []

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        sent_messages.append(message)

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "method": "POST",
            "path": "/test",
            "headers": [(b"content-length", b"invalid_number")],
            "state": {"request_id": "test-malformed-len"},
        },
        receive,
        send,
    )

    assert app_called is False
    assert any(
        message["type"] == "http.response.start" and message["status"] == 413
        for message in sent_messages
    )


@pytest.mark.asyncio
async def test_client_disconnect_handled_gracefully() -> None:
    app_called = False

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        pass

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    # Should exit cleanly without calling app and without error
    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "method": "POST",
            "path": "/test",
            "headers": [],
        },
        receive,
        send,
    )

    assert app_called is False


@pytest.mark.asyncio
async def test_atypical_asgi_events_preserved() -> None:
    app_called = False
    received_types = []

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True
        msg1 = await receive()
        received_types.append(msg1["type"])
        msg2 = await receive()
        received_types.append(msg2["type"])

    sequence = [
        {"type": "http.custom_extension", "data": "extra"},
        {"type": "http.request", "body": b"valid", "more_body": False},
    ]

    async def receive():
        if sequence:
            return sequence.pop(0)
        return {"type": "http.disconnect"}

    async def send(message):
        pass

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "method": "POST",
            "path": "/test",
            "headers": [],
        },
        receive,
        send,
    )

    assert app_called is True
    assert "http.custom_extension" in received_types
    assert "http.request" in received_types


@pytest.mark.asyncio
async def test_non_http_scope_bypasses_middleware() -> None:
    app_called = False

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True

    async def receive():
        return {"type": "websocket.receive"}

    async def send(message):
        pass

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    await middleware(
        {"type": "websocket", "asgi": {"version": "3.0"}},
        receive,
        send,
    )

    assert app_called is True


@pytest.mark.asyncio
async def test_413_response_contains_security_headers_and_request_id() -> None:
    sent_messages = []

    async def app(scope, receive, send):
        pass

    async def receive():
        return {"type": "http.request", "body": b"x" * 2048, "more_body": False}

    async def send(message):
        sent_messages.append(message)

    middleware = RequestSizeLimitMiddleware(app, max_size_bytes=1024)

    custom_id = "test-asgi-trace-999"
    await middleware(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "method": "POST",
            "path": "/test",
            "headers": [(b"x-request-id", custom_id.encode("ascii"))],
            "state": {"request_id": custom_id},
        },
        receive,
        send,
    )

    start_msg = next(m for m in sent_messages if m["type"] == "http.response.start")
    assert start_msg["status"] == 413

    headers_dict = {
        k.decode("latin-1").lower(): v.decode("latin-1")
        for k, v in start_msg["headers"]
    }
    assert headers_dict["x-content-type-options"] == "nosniff"
    assert headers_dict["x-frame-options"] == "DENY"
    assert headers_dict["referrer-policy"] == "no-referrer"
    assert headers_dict["x-request-id"] == custom_id

    body_msg = next(m for m in sent_messages if m["type"] == "http.response.body")
    payload = json.loads(body_msg["body"].decode("utf-8"))
    assert payload["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert payload["error"]["request_id"] == custom_id
