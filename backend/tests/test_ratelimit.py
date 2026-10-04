import pytest

from app.core import ratelimit
from app.core.ratelimit import FailureLimiter, RateLimited


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


def test_blocks_after_max_failures_and_reports_retry_time(clock: Clock) -> None:
    limiter = FailureLimiter(3, 60, clock)
    for _ in range(3):
        limiter.check("k")
        limiter.fail("k")
    clock.now += 10
    with pytest.raises(RateLimited) as blocked:
        limiter.check("k")
    assert 49 <= blocked.value.retry_after <= 52  # 60 s window - 10 s elapsed


def test_failures_expire_after_the_window(clock: Clock) -> None:
    limiter = FailureLimiter(2, 60, clock)
    limiter.fail("k")
    limiter.fail("k")
    clock.now += 61
    limiter.check("k")  # no longer blocked


def test_keys_are_independent_and_reset_clears_one(clock: Clock) -> None:
    limiter = FailureLimiter(1, 60, clock)
    limiter.fail("a")
    with pytest.raises(RateLimited):
        limiter.check("a")
    limiter.check("b")
    limiter.reset("a")
    limiter.check("a")


def test_memory_is_bounded_when_keys_are_sprayed(clock: Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ratelimit, "MAX_KEYS", 5)
    limiter = FailureLimiter(1, 60, clock)
    for i in range(20):
        limiter.fail(f"user{i}")
    assert limiter.tracked_keys <= 5


def test_clear_forgets_everything(clock: Clock) -> None:
    limiter = FailureLimiter(1, 60, clock)
    limiter.fail("a")
    limiter.clear()
    limiter.check("a")
