"""Provider-agnostic LLM layer. Switch providers with LLM_PROVIDER in .env or in the settings page."""

import json
import logging
import re
import threading
import time
from typing import Any, Literal, get_args

import httpx
from pydantic import BaseModel, TypeAdapter, ValidationError

from app.core.config import settings
from app.core.enums import Lang, Provider, TermCategory

log = logging.getLogger(__name__)
LANG_NAMES: dict[str, str] = {Lang.DE: "German", Lang.EN: "English"}  # as written in the prompt
LLMTermCategory = Literal[
    TermCategory.TECHNICAL, TermCategory.AMBIGUOUS, TermCategory.UNKNOWN
]  # what the model may use

PROMPT = """You are a professional translator for the German kitchen and furniture industry (Rotpunkt Küchen).
Translate each segment from {src} into {tgt}. Rules:
1. Keep article numbers, product names and codes exactly as written.
2. Every entry in a segment's "glossary" list MUST be translated as given ("dnt": keep unchanged).
3. Keep numbers, units, line breaks and punctuation. Do not add explanations.
4. Use correct kitchen terminology (Korpus=carcass, Frontblende=front panel, Sockelblende=plinth).
5. In "terms" list ONLY genuinely industry-specific terms (materials, parts, fittings, appliances, processes)
   that are NOT already in the glossary list. Never list everyday words ("Artikel", "Preis", "Montage"):
   "technical" = normal kitchen term; "ambiguous" = several plausible translations (list in "alternatives");
   "unknown" = unclear, misspelled or unrecognisable term.
   "source"/"target" must be the exact text as it appears in the source segment / your translation.
   "description": max 12 words in {src}.
Return only JSON."""

_S = {"type": "STRING"}
SCHEMA: dict[str, Any] = {  # Gemini response schema
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "required": ["id", "translation"],
        "properties": {
            "id": {"type": "INTEGER"},
            "translation": _S,
            "terms": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "required": ["source", "target", "category"],
                    "properties": {
                        "source": _S,
                        "target": _S,
                        "description": _S,
                        "alternatives": {"type": "ARRAY", "items": _S},
                        "category": {"type": "STRING", "enum": list(get_args(LLMTermCategory))},
                    },
                },
            },
        },
    },
}


class Hint(BaseModel):
    source: str
    target: str
    dnt: bool


class LLMSegment(BaseModel):
    id: int
    text: str
    glossary: list[Hint] = []


class LLMTerm(BaseModel):
    source: str
    target: str = ""
    category: LLMTermCategory
    alternatives: list[str] = []
    description: str = ""


class LLMResult(BaseModel):
    id: int
    translation: str
    terms: list[LLMTerm] = []


class LLMError(RuntimeError):
    pass


class LLMProvider:
    def translate_batch(self, src: str, tgt: str, segments: list[LLMSegment]) -> list[LLMResult]:
        raise NotImplementedError


class Gemini(LLMProvider):
    _lock = threading.Lock()
    _last = 0.0

    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise LLMError("GEMINI_API_KEY ist nicht gesetzt (siehe .env.example).")
        self.key = api_key
        self.models = [model, *(m for m in settings.gemini_fallback_models if m != model)]

    def _throttle(self) -> None:  # the free tier is rate limited
        with self._lock:
            wait = settings.llm_min_interval - (time.time() - Gemini._last)
            if wait > 0:
                time.sleep(wait)
            Gemini._last = time.time()

    def translate_batch(self, src: str, tgt: str, segments: list[LLMSegment]) -> list[LLMResult]:
        body = {
            "systemInstruction": {"parts": [{"text": PROMPT.format(src=LANG_NAMES[src], tgt=LANG_NAMES[tgt])}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": json.dumps([s.model_dump() for s in segments], ensure_ascii=False)}],
                }
            ],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json", "responseSchema": SCHEMA},
        }
        error = ""
        for model in self.models:  # free-tier models get overloaded or retired: fall back to the next one
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for attempt in range(2):
                self._throttle()
                status = 0
                try:
                    r = httpx.post(url, json=body, headers={"x-goog-api-key": self.key}, timeout=120)
                except httpx.HTTPError as e:
                    error = f"{model}: {e}"
                else:
                    status = r.status_code
                    if status == 200:
                        try:
                            text: str = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                            return TypeAdapter(list[LLMResult]).validate_json(text)
                        except (KeyError, IndexError, ValidationError) as e:
                            error = f"{model}: ungültige Antwort ({e})"
                    elif status in (404, 429, 500, 503):
                        error = f"{model}: HTTP {status}"
                    else:
                        raise LLMError(f"Gemini-Fehler {status}: {r.text[:300]}")
                log.warning("Gemini attempt failed (%s)", error)
                if status == 404:  # model retired for this key -> next model right away
                    break
                time.sleep(5 * (attempt + 1))
        raise LLMError(f"Gemini nicht erreichbar oder Limit überschritten ({error})")


DICT_DE_EN = {
    "korpus": "carcass",
    "frontblende": "front panel",
    "arbeitsplatte": "worktop",
    "sockelblende": "plinth",
    "unterschrank": "base unit",
    "hängeschrank": "wall unit",
    "auszug": "pull-out",
    "schublade": "drawer",
    "griff": "handle",
    "küche": "kitchen",
    "der": "the",
    "die": "the",
    "das": "the",
    "und": "and",
    "mit": "with",
    "ist": "is",
    "für": "for",
    "spüle": "sink",
    "backofen": "oven",
    "tür": "door",
    "scharnier": "hinge",
    "farbe": "colour",
    "weiß": "white",
    "eiche": "oak",
    "preis": "price",
    "montage": "assembly",
}
DICTS = {"de-en": DICT_DE_EN, "en-de": {v: k for k, v in DICT_DE_EN.items()}}
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")


class Mock(LLMProvider):
    """Offline word-by-word dictionary: lets the app and the tests run without an API key."""

    def translate_batch(self, src: str, tgt: str, segments: list[LLMSegment]) -> list[LLMResult]:
        table = DICTS.get(f"{src}-{tgt}", {})

        def word(m: re.Match[str]) -> str:
            src = m.group(0)
            if (t := table.get(src.lower())) is None:
                return src  # unknown words (codes, names) stay untouched
            return t.capitalize() if src[0].isupper() else t

        out: list[LLMResult] = []
        for s in segments:
            text = s.text
            for i, h in enumerate(s.glossary):
                text = re.sub(re.escape(h.source), f"⟦{i}⟧", text, flags=re.I)
            text = WORD.sub(word, text)
            for i, h in enumerate(s.glossary):
                text = text.replace(f"⟦{i}⟧", h.source if h.dnt else h.target)
            terms = [
                LLMTerm(
                    source=w, target=table[w.lower()], category=TermCategory.TECHNICAL, description="Fachbegriff (Mock)"
                )
                for w in WORD.findall(s.text)
                if len(w) > 5 and w.lower() in table
            ]
            out.append(LLMResult(id=s.id, translation=text, terms=terms[:5]))
        return out


def get_provider(name: str | None = None, model: str | None = None) -> LLMProvider:
    try:
        provider = Provider((name or settings.llm_provider).lower())
    except ValueError:
        raise LLMError(f"Unbekannter LLM-Provider: {name}") from None
    if provider == Provider.MOCK:
        return Mock()
    return Gemini(settings.gemini_api_key, model or settings.gemini_model)
