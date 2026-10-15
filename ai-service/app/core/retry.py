"""Bounded retry utility with exponential backoff and jitter."""

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable

logger = logging.getLogger("ai_service.retry")


async def with_retry[T](
    func: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    max_delay: float = 5.0,
    retryable_exceptions: tuple[type[Exception], ...] = (Exception,),
    operation_name: str = "operation",
) -> T:
    """Execute async operation with bounded exponential backoff retries.

    Args:
        func: Zero-argument async callable.
        max_retries: Maximum number of retry attempts (excluding the initial attempt).
        initial_delay: Delay in seconds before first retry.
        backoff_factor: Multiplier for exponential backoff.
        max_delay: Maximum delay cap in seconds.
        retryable_exceptions: Tuple of exception types to catch and retry.
        operation_name: Human-readable name for logging.
    """
    delay = initial_delay

    for attempt in range(1, max_retries + 2):
        try:
            return await func()
        except retryable_exceptions as exc:
            if attempt > max_retries:
                logger.error(
                    "Exhausted retries (%d/%d) for %s: %s: %s",
                    attempt - 1,
                    max_retries,
                    operation_name,
                    type(exc).__name__,
                    str(exc),
                )
                raise

            # Add jitter (+/- 20%) to prevent thundering herd
            jitter = delay * random.uniform(0.8, 1.2)  # noqa: S311
            logger.warning(
                "Attempt %d/%d failed for %s (%s). Retrying in %.2fs...",
                attempt,
                max_retries,
                operation_name,
                type(exc).__name__,
                jitter,
            )
            await asyncio.sleep(jitter)
            delay = min(delay * backoff_factor, max_delay)

    raise RuntimeError(f"Unexpected termination in retry loop for {operation_name}")
