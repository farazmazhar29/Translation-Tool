"""Detect whether an uploaded text is German or English."""

import re

from app.core.enums import Lang


def target_languages(source: str) -> list[str]:
    """With two languages the target is always the other one; none while the source is still unknown."""
    return [lang for lang in Lang if lang != source] if source in list(Lang) else []


STOPWORDS = {
    Lang.DE: set(
        "der die das und ist nicht mit für auf den dem ein eine zu von im auch sich des wird sind bei nach oder".split()
    ),
    Lang.EN: set("the and is not with for on of to in a an this that are be by or from at as it can will".split()),
}


def detect_language(texts: list[str]) -> str:
    """Stopword heuristic for de/en ('' if unclear -> the user picks the language manually)."""
    words = re.findall(r"[a-zäöüß]+", " ".join(texts).lower())
    score = {lang: sum(w in sw for w in words) for lang, sw in STOPWORDS.items()}
    best = max(score, key=lambda k: score[k])
    return best if score[best] >= 2 and score[best] > 1.3 * min(score.values()) else ""
