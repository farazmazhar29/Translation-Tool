"""Errors the user sees. The code carries an English message (for developers and the logs) and a `code` with its
`params`, from which the interface writes its own text in the user's language (German or English)."""

from enum import StrEnum
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

Param = str | int | float


class ErrorCode(StrEnum):
    """One per message the interface translates (`errors` in the frontend's common texts)."""

    # accounts
    USERNAME_TAKEN = "username_taken"
    USERNAME_RETIRED = "username_retired"
    TOO_MANY_ATTEMPTS = "too_many_attempts"
    WRONG_CREDENTIALS = "wrong_credentials"
    REGISTRATION_DISABLED = "registration_disabled"
    TOO_MANY_REGISTRATIONS = "too_many_registrations"
    USER_NOT_FOUND = "user_not_found"
    OWN_ADMIN_ROLE = "own_admin_role"
    OWN_ACCOUNT = "own_account"
    NO_PERMISSION = "no_permission"
    NOT_LOGGED_IN = "not_logged_in"
    PASSWORD_TOO_SHORT = "password_too_short"  # noqa: S105 - an error code, not a password
    # projects and files
    PROJECT_NOT_FOUND = "project_not_found"
    PROJECT_LOCKED = "project_locked"
    SEGMENT_NOT_FOUND = "segment_not_found"
    FILE_TOO_LARGE = "file_too_large"
    INVALID_SOURCE_LANG = "invalid_source_lang"
    INDESIGN_LATER = "indesign_later"
    FILE_TYPE_UNSUPPORTED = "file_type_unsupported"
    FILE_CONTENT_MISMATCH = "file_content_mismatch"
    FILE_UNREADABLE = "file_unreadable"
    NO_TEXT = "no_text"
    PDF_NO_TEXT = "pdf_no_text"
    NOT_A_SHEET = "not_a_sheet"
    # translation
    TRANSLATION_RUNNING = "translation_running"
    SOURCE_UNKNOWN = "source_unknown"
    GEMINI_KEY_MISSING = "gemini_key_missing"
    GEMINI_ERROR = "gemini_error"
    GEMINI_UNREACHABLE = "gemini_unreachable"
    SERVER_RESTARTED = "server_restarted"
    TRANSLATION_FAILED = "translation_failed"
    # review, quality, export
    CANNOT_APPROVE = "cannot_approve"
    SEGMENTS_UNTRANSLATED = "segments_untranslated"
    RELEASE_NOT_FOUND = "release_not_found"
    FINDINGS_NOT_ACCEPTABLE = "findings_not_acceptable"
    EXPORT_BEFORE_APPROVAL = "export_before_approval"
    EXPORT_NOT_FOUND = "export_not_found"
    # glossary
    TERM_REQUIRED = "term_required"
    DUPLICATE = "duplicate"
    ENTRY_NOT_FOUND = "entry_not_found"
    EXCEL_UNREADABLE = "excel_unreadable"
    EXCEL_COLUMNS_MISSING = "excel_columns_missing"
    # settings and operations
    UNKNOWN_PROVIDER = "unknown_provider"
    UNKNOWN_MODEL = "unknown_model"
    DATABASE_UNREACHABLE = "database_unreachable"
    INTERNAL_ERROR = "internal_error"


class AppError(HTTPException):
    """An HTTP error with a code: answered as `{"detail": message, "code": ..., "params": {...}}`."""

    def __init__(
        self,
        status: int,
        code: ErrorCode,
        message: str,
        params: dict[str, Param] | None = None,
        *,
        detail: Any = None,  # instead of the message, when the client needs more (e.g. the duplicates found)
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status, message if detail is None else detail, headers)
        self.code = code
        self.params = params or {}


class CodedError(Exception):
    """An error raised away from HTTP (parsing a file, a background job) that still has a code for the interface."""

    def __init__(self, code: ErrorCode, message: str, params: dict[str, Param] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.params = params or {}

    def http(self, status: int) -> AppError:
        return AppError(status, self.code, str(self), self.params)


def error_body(code: ErrorCode, detail: Any, params: dict[str, Param] | None = None) -> dict[str, Any]:
    return {"detail": detail, "code": code, "params": params or {}}


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):  # registered for AppError only
        raise exc
    return JSONResponse(error_body(exc.code, exc.detail, exc.params), exc.status_code, headers=exc.headers)
