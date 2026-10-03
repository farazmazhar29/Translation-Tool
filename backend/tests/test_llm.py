import json
from typing import Any

import httpx
import pytest

from app.config import settings
from app.services import llm
from app.services.llm import Gemini, Hint, LLMError, LLMResult, LLMSegment, Mock, get_provider

SEGMENTS = [
    LLMSegment(id=1, text="Der Korpus ist weiß.", glossary=[Hint(source="Korpus", target="carcass", dnt=False)])
]
GOOD_TEXT = json.dumps([{"id": 1, "translation": "The carcass is white.", "terms": []}])


def ok(text: str = GOOD_TEXT) -> httpx.Response:
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


class FakeTime:
    """Replaces the `time` module inside llm.py: no real sleeping, and we can inspect the waits."""

    def __init__(self) -> None:
        self.now = 1_000_000.0
        self.slept: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


class FakeApi:
    """Scripted Gemini endpoint: returns the queued responses in order and records every request."""

    def __init__(self, *responses: httpx.Response | Exception) -> None:
        self.queue = list(responses)
        self.requests: list[dict[str, Any]] = []

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        self.requests.append({"url": url, **kwargs})
        item = self.queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    @property
    def models(self) -> list[str]:
        return [str(r["url"]).split("/models/")[1].split(":")[0] for r in self.requests]


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> FakeTime:
    fake = FakeTime()
    monkeypatch.setattr(llm, "time", fake)
    monkeypatch.setattr(Gemini, "_last", 0.0)
    return fake


def provider(api: FakeApi, monkeypatch: pytest.MonkeyPatch, model: str = "m1") -> Gemini:
    monkeypatch.setattr(llm.httpx, "post", api.post)
    monkeypatch.setattr(settings, "gemini_fallback_models", ["m2", "m3"])
    return Gemini("secret-key", model)


# Gemini: happy path
def test_successful_call_parses_the_structured_answer(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(ok())
    result = provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert result == [LLMResult(id=1, translation="The carcass is white.", terms=[])]
    assert clock.slept == []


def test_request_carries_key_languages_glossary_and_schema(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(ok())
    provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    request = api.requests[0]
    assert request["headers"] == {"x-goog-api-key": "secret-key"}  # key in a header, never in the URL
    assert "secret-key" not in request["url"]
    body = request["json"]
    assert "German into English" in body["systemInstruction"]["parts"][0]["text"]
    assert "Korpus" in body["contents"][0]["parts"][0]["text"]
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert "responseSchema" in body["generationConfig"]


# Gemini retry and model fallback
def test_transient_error_is_retried_on_the_same_model(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(httpx.Response(503), ok())
    assert provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)[0].translation
    assert api.models == ["m1", "m1"]
    assert clock.slept == [5]


def test_overloaded_model_falls_back_to_the_next_one(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(httpx.Response(503), httpx.Response(429), ok())
    provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert api.models == ["m1", "m1", "m2"]


def test_retired_model_is_skipped_immediately(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(httpx.Response(404), ok())
    provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert api.models == ["m1", "m2"]
    assert clock.slept == []  # no point in waiting for a model that no longer exists


def test_network_errors_are_retried(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(httpx.ConnectError("boom"), ok())
    provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert api.models == ["m1", "m1"]


@pytest.mark.parametrize("garbage", ["not json at all", "[]]", json.dumps([{"id": "x"}]), json.dumps({"id": 1})])
def test_unusable_answers_are_retried_and_then_reported(
    monkeypatch: pytest.MonkeyPatch, clock: FakeTime, garbage: str
) -> None:
    api = FakeApi(*[ok(garbage)] * 6)
    with pytest.raises(LLMError, match="ungültige Antwort"):
        provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert api.models == ["m1", "m1", "m2", "m2", "m3", "m3"]


def test_response_without_candidates_is_treated_as_invalid(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}), ok())
    provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert api.models == ["m1", "m1"]


def test_all_models_failing_raises_with_the_last_reason(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(*[httpx.Response(503)] * 6)
    with pytest.raises(LLMError, match=r"m3: HTTP 503"):
        provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert len(api.requests) == 6


def test_client_errors_fail_fast_without_trying_other_models(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    api = FakeApi(httpx.Response(400, text="API key not valid"))
    with pytest.raises(LLMError, match=r"Gemini-Fehler 400: API key not valid"):
        provider(api, monkeypatch).translate_batch("de", "en", SEGMENTS)
    assert len(api.requests) == 1


def test_primary_model_is_not_repeated_in_the_fallback_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_fallback_models", ["m1", "m2"])
    assert Gemini("k", "m1").models == ["m1", "m2"]


# Gemini: rate limit throttle
def test_calls_are_spaced_to_respect_the_free_tier(monkeypatch: pytest.MonkeyPatch, clock: FakeTime) -> None:
    monkeypatch.setattr(settings, "llm_min_interval", 4.0)
    api = FakeApi(ok(), ok())
    gemini = provider(api, monkeypatch)
    gemini.translate_batch("de", "en", SEGMENTS)
    gemini.translate_batch("de", "en", SEGMENTS)
    assert clock.slept == [4.0]  # the second call had to wait for the interval


# provider factory
def test_missing_api_key_is_reported_clearly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(LLMError, match="GEMINI_API_KEY"):
        get_provider("gemini")


def test_factory_returns_the_requested_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", "k")
    assert isinstance(get_provider("mock"), Mock)
    assert get_provider("GEMINI", "custom-model").models[0] == "custom-model"  # type: ignore[attr-defined]  # pyright: ignore[reportAttributeAccessIssue]
    with pytest.raises(LLMError, match="Unbekannter"):
        get_provider("skynet")


# mock provider
def translate(text: str, src: str = "de", tgt: str = "en", glossary: list[Hint] | None = None) -> LLMResult:
    return Mock().translate_batch(src, tgt, [LLMSegment(id=1, text=text, glossary=glossary or [])])[0]


def test_mock_translates_known_words_and_keeps_case() -> None:
    assert translate("Der Griff ist weiß").translation == "The Handle is white"


def test_mock_leaves_codes_and_unknown_words_untouched() -> None:
    assert translate("Preis UK-4711/60 Zzyzx").translation == "Price UK-4711/60 Zzyzx"


def test_mock_applies_glossary_hints_and_respects_do_not_translate() -> None:
    result = translate(
        "Rotpunkt Korpus",
        glossary=[
            Hint(source="Rotpunkt", target="Rotpunkt", dnt=True),
            Hint(source="Korpus", target="carcass", dnt=False),
        ],
    )
    assert result.translation == "Rotpunkt carcass"


def test_mock_works_in_both_directions_and_lists_terms() -> None:
    assert translate("kitchen oven", "en", "de").translation == "küche backofen"
    terms = translate("Der Hängeschrank mit Auszug").terms
    assert {t.source for t in terms} == {"Hängeschrank", "Auszug"}
    assert all(t.category == "technical" for t in terms)


def test_mock_caps_the_number_of_listed_terms() -> None:
    text = " ".join(
        ["Hängeschrank", "Unterschrank", "Arbeitsplatte", "Frontblende", "Sockelblende", "Schublade", "Scharnier"]
    )
    assert len(translate(text).terms) == 5
