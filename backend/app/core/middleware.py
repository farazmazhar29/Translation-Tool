"""Cross-cutting HTTP concerns: request id + access log, security headers, last-resort error handler."""

import logging
import re
import time
import uuid

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint

from .config import settings
from .logging_setup import request_id_var

log = logging.getLogger("app.access")
SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
DOC_PATHS = ("/docs", "/redoc", "/openapi.json")  # Swagger UI loads its assets from a CDN, so no strict CSP there

# The SPA only needs its own scripts/styles; `style-src-attr` allows the inline style="" attributes React renders.
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; "
    "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; "
    "frame-ancestors 'none'"
)
HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_context(request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("x-request-id", "")
        rid = incoming if SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex[:16]
        request.state.request_id = rid  # also read by the error handler, which runs outside this middleware
        token = request_id_var.set(rid)
        started = time.perf_counter()
        try:
            response = await call_next(request)
            elapsed_ms = (time.perf_counter() - started) * 1000
            log.info("%s %s -> %d (%.0f ms)", request.method, request.url.path, response.status_code, elapsed_ms)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = rid
        return response

    @app.middleware("http")
    async def security_headers(request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        for name, value in HEADERS.items():
            response.headers.setdefault(name, value)
        if not request.url.path.startswith(DOC_PATHS):
            response.headers.setdefault("Content-Security-Policy", CSP)
        if settings.enable_hsts:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        rid = str(getattr(request.state, "request_id", "-"))
        token = request_id_var.set(rid)
        try:
            logging.getLogger("app.error").error(
                "Unhandled error on %s %s", request.method, request.url.path, exc_info=exc
            )
        finally:
            request_id_var.reset(token)
        return JSONResponse({"detail": "Interner Fehler. Bitte später erneut versuchen.", "request_id": rid}, 500)
