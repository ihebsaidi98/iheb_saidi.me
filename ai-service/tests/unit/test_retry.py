"""Unit tests for bounded retry logic."""

import pytest

from app.core.retry import with_retry


@pytest.mark.asyncio
async def test_retry_succeeds_first_attempt() -> None:
    calls = 0

    async def sample_op() -> str:
        nonlocal calls
        calls += 1
        return "success"

    res = await with_retry(sample_op, max_retries=2, initial_delay=0.01)
    assert res == "success"
    assert calls == 1


@pytest.mark.asyncio
async def test_retry_recovers_after_transient_failure() -> None:
    calls = 0

    async def flaky_op() -> str:
        nonlocal calls
        calls += 1
        if calls < 3:
            raise ConnectionError("Network blip")
        return "recovered"

    res = await with_retry(
        flaky_op,
        max_retries=3,
        initial_delay=0.01,
        retryable_exceptions=(ConnectionError,),
    )
    assert res == "recovered"
    assert calls == 3


@pytest.mark.asyncio
async def test_retry_raises_when_exhausted() -> None:
    calls = 0

    async def broken_op() -> str:
        nonlocal calls
        calls += 1
        raise ValueError("Permanent flaw")

    with pytest.raises(ValueError, match="Permanent flaw"):
        await with_retry(
            broken_op,
            max_retries=2,
            initial_delay=0.01,
            retryable_exceptions=(ValueError,),
        )

    # 1 initial attempt + 2 retries = 3 calls
    assert calls == 3
