from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.config import DEV_SECRET, Settings, settings
from app.core.db import get_db
from app.main import app


def test_security_headers_on_api_responses(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Referrer-Policy"] == "same-origin"
    csp = r.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "unsafe-eval" not in csp
    assert "Strict-Transport-Security" not in r.headers  # only behind HTTPS (ENABLE_HSTS)


def test_swagger_ui_is_not_blocked_by_the_strict_csp(client: TestClient) -> None:
    docs = client.get("/docs")
    assert docs.status_code == 200
    assert "Content-Security-Policy" not in docs.headers  # its assets load from a CDN
    assert docs.headers["X-Content-Type-Options"] == "nosniff"


def test_hsts_can_be_enabled(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "enable_hsts", True)
    assert "max-age=" in client.get("/api/health").headers["Strict-Transport-Security"]


# request id
def test_every_response_has_a_request_id(client: TestClient) -> None:
    first, second = client.get("/api/health"), client.get("/api/health")
    assert len(first.headers["X-Request-ID"]) >= 8
    assert first.headers["X-Request-ID"] != second.headers["X-Request-ID"]


def test_a_sane_incoming_request_id_is_kept_and_a_malicious_one_replaced(client: TestClient) -> None:
    kept = client.get("/api/health", headers={"X-Request-ID": "trace-12345678"})
    assert kept.headers["X-Request-ID"] == "trace-12345678"
    replaced = client.get("/api/health", headers={"X-Request-ID": "bad id\r\nX-Injected: 1"})
    assert replaced.headers["X-Request-ID"] != "bad id"
    assert "X-Injected" not in replaced.headers


# error handling
def test_unhandled_errors_return_json_with_the_request_id_and_no_internals() -> None:
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    app.add_api_route("/api/_test_boom", boom, include_in_schema=False)
    route = app.router.routes.pop()
    app.router.routes.insert(0, route)  # ahead of the SPA catch-all, which exists once the frontend is built
    try:
        r = TestClient(app, raise_server_exceptions=False).get(
            "/api/_test_boom", headers={"X-Request-ID": "trace-abcdefgh"}
        )
    finally:
        app.router.routes.remove(route)
    assert r.status_code == 500
    assert r.json() == {
        "detail": "Internal error. Please try again later.",
        "code": "internal_error",
        "params": {},
        "request_id": "trace-abcdefgh",
    }
    assert "secret internal detail" not in r.text


# health / readiness
def test_liveness_and_readiness(client: TestClient) -> None:
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/ready").json() == {"status": "ready"}


def test_readiness_fails_with_503_when_the_database_is_down(client: TestClient) -> None:
    class BrokenSession:
        def execute(self, *_: Any) -> None:
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    def broken() -> Iterator[BrokenSession]:
        yield BrokenSession()

    app.dependency_overrides[get_db] = broken
    try:
        r = client.get("/api/ready")
    finally:
        app.dependency_overrides.pop(get_db)
    assert r.status_code == 503
    assert "connection refused" not in r.text  # no internals in the response


# CORS
def test_cors_allows_the_configured_origin_only(client: TestClient) -> None:
    ask = {"Access-Control-Request-Method": "GET"}
    allowed = client.options("/api/projects", headers={**ask, "Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options("/api/projects", headers={**ask, "Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in denied.headers


# production configuration guard
def production(**over: Any) -> Settings:
    values: dict[str, Any] = {"environment": "production", "secret_key": "s" * 40, "seed_demo_data": False} | over
    return Settings(_env_file=None, **values)  # pyright: ignore[reportCallIssue]


def test_production_accepts_a_secure_configuration() -> None:
    assert production().environment == "production"


@pytest.mark.parametrize(
    ("over", "message"),
    [
        ({"secret_key": DEV_SECRET}, "SECRET_KEY"),
        ({"secret_key": "too-short"}, "SECRET_KEY"),
        ({"seed_demo_data": True}, "SEED_DEMO_DATA"),
    ],
)
def test_production_refuses_insecure_configuration(over: dict[str, Any], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        production(**over)


def test_development_keeps_working_with_the_dev_defaults() -> None:
    dev = Settings(_env_file=None, environment="development", secret_key=DEV_SECRET, seed_demo_data=True)  # pyright: ignore[reportCallIssue]
    assert dev.environment == "development"  # only production refuses the insecure defaults
