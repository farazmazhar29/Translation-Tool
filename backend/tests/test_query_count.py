"""Opening a project must not cost one database query per segment (the N+1 problem of lazy loading)."""

from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from conftest import Headers, docx_bytes, upload
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.db import engine

PARAGRAPHS = 60


@contextmanager
def counted_statements() -> Generator[list[str]]:
    statements: list[str] = []

    def record(_conn: Any, _cursor: Any, statement: str, *_: Any) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


def test_project_endpoints_use_a_constant_number_of_queries(client: TestClient, translator: Headers) -> None:
    paragraphs = [f"Der Korpus Nummer {i} ist weiß." for i in range(PARAGRAPHS)]
    pid: int = upload(client, translator, "many.docx", docx_bytes(*paragraphs))["id"]
    assert client.post(f"/api/projects/{pid}/translate", headers=translator).status_code == 200

    for path in (f"/api/projects/{pid}", f"/api/projects/{pid}/quality"):
        with counted_statements() as statements:
            r = client.get(path, headers=translator)
        assert r.status_code == 200
        assert len(statements) <= 8, f"{path}: {len(statements)} statements for {PARAGRAPHS} segments"
