import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

_tmp = Path(tempfile.mkdtemp())
os.environ.update(
    DATABASE_URL=f"sqlite:///{_tmp / 't.db'}", DATA_DIR=str(_tmp), LLM_PROVIDER="mock", LLM_MIN_INTERVAL="0"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def login(client: TestClient, user: str) -> dict[str, str]:
    r = client.post("/api/auth/login", data={"username": user, "password": f"{user}123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin(client: TestClient) -> dict[str, str]:
    return login(client, "admin")


@pytest.fixture(scope="session")
def reviewer(client: TestClient) -> dict[str, str]:
    return login(client, "reviewer")


@pytest.fixture(scope="session")
def translator(client: TestClient) -> dict[str, str]:
    return login(client, "translator")
