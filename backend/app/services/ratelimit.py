"""Brute-force protection for the login: block a key after too many failures inside a time window.

In-memory and per process – enough for one server; behind several workers use a shared store (e.g. Redis).
"""

import threading
import time
from collections import deque
from collections.abc import Callable

MAX_KEYS = 10_000  # bound memory if someone sprays random usernames


class RateLimited(Exception):  # noqa: N818  (reads better than RateLimitedError at call sites)
    def __init__(self, retry_after: int) -> None:
        super().__init__(f"rate limited, retry in {retry_after}s")
        self.retry_after = retry_after


class FailureLimiter:
    def __init__(self, max_failures: int, window_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.max_failures, self.window, self.clock = max_failures, window_seconds, clock
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str) -> deque[float]:
        events = self._failures.get(key, deque())
        cutoff = self.clock() - self.window
        while events and events[0] <= cutoff:
            events.popleft()
        if events:
            self._failures[key] = events
        else:
            self._failures.pop(key, None)
        return events

    def check(self, key: str) -> None:
        """Raise `RateLimited` if the key already used up its failures."""
        with self._lock:
            events = self._recent(key)
            if len(events) >= self.max_failures:
                raise RateLimited(max(1, int(events[0] + self.window - self.clock()) + 1))

    def fail(self, key: str) -> None:
        with self._lock:
            if len(self._failures) >= MAX_KEYS:
                self._failures.clear()  # crude but safe: an attack on memory must not take the login down
            self._failures.setdefault(key, deque()).append(self.clock())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    @property
    def tracked_keys(self) -> int:
        return len(self._failures)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()
