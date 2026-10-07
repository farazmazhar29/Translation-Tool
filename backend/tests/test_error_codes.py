"""Every error code the API sends has a text in both languages of the interface, and nothing else is there."""

import re
from pathlib import Path

import pytest

from app.core.errors import ErrorCode

COMMON = Path(__file__).resolve().parents[2] / "frontend" / "src" / "shared" / "i18n" / "common"


@pytest.mark.parametrize("language", ["de", "en"])
def test_every_error_code_has_a_text_in_the_interface(language: str) -> None:
    texts = (COMMON / f"{language}.ts").read_text(encoding="utf-8")
    block = texts.split("  errors: {\n")[1].split("\n  },")[0]
    assert set(re.findall(r"^    (\w+): ", block, re.MULTILINE)) == {c.value for c in ErrorCode}
