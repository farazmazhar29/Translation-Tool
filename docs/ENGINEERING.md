# Engineering log

> **Purpose.** This document explains *what* was built, *which tools and libraries* were chosen, and above all *why*.
> It is updated with every change. Newest entries are at the end of each section. For setup and features see the
> [README](../README.md).
> **Audience:** reviewers of this take-home task (Rotpunkt Küchen) and the author.

## 1. Principles

| Principle | What it means in practice |
|---|---|
| **Types are documentation** | Strict typing on both sides; API types are generated from the backend contract, never hand-written twice. |
| **Automate every rule** | If a standard matters it is enforced by a tool (linter, type checker, CI), not by memory or code review. |
| **Human in the loop** | AI output is a *preview*; only a reviewer's approval creates the final translation. |
| **Deterministic where possible** | Glossary matching, protected terms and quality checks are plain code. The LLM only does what code cannot. |
| **Run anywhere, cost nothing** | Free LLM tier for development, pluggable provider, offline mock for tests, one Docker image for deployment. |
| **Small, readable code** | Prefer a short typed schema over hand-written serialisation; remove code instead of commenting it out. |

## 2. Stack and libraries (and why)

### Backend (Python 3.12)

| Library | Used for | Why this one | Rejected alternative |
|---|---|---|---|
| **FastAPI 0.142** (Starlette 1.7) | REST API | Typed request/response models, automatic **Swagger/OpenAPI** docs, async-ready, the standard for Python AI services. Upgraded from 0.115 because Starlette 0.41 had 14 known advisories (D-26) | Flask (no typing/docs built in), Django (heavier than needed) |
| **Pydantic v2** | Validation, API contract (`schemas.py`) | One typed source of truth for input validation, output shape and the docs | Hand-written dicts |
| **SQLAlchemy 2** | ORM | Fully typed `Mapped[...]` models, works with SQLite (dev) and PostgreSQL (prod) | Raw SQL, SQLModel (less mature typing) |
| **PostgreSQL** (Docker) / **SQLite** (dev) | Persistence | Same code, zero-setup development, real DB in production | MongoDB (data is relational) |
| **python-docx, openpyxl, PyMuPDF** | Read/write Word, Excel, PDF | Edit files *in place* so formatting and formulas survive | Converting everything to text |
| **ReportLab** | PDF export | Pure Python, no system dependencies | WeasyPrint (needs native libs) |
| **httpx** | Gemini HTTP calls | Modern, typed, timeouts | requests |
| **PyJWT 2.15** | Login tokens | Stateless auth; `exp` and `sub` are *required* claims | Server-side sessions (state to store) |
| **argon2-cffi** | Password hashing | **Argon2id**, the algorithm OWASP recommends first (memory-hard, resists GPU cracking) | PBKDF2 (first version, 120k iterations - below OWASP's 600k), bcrypt, passlib (version friction) |
| **Alembic** | Database migrations | Versioned, reviewable schema changes; `create_all` cannot evolve a production database | `create_all` only, hand-written SQL |
| **pydantic-settings** | Config from `.env` | Typed settings, 12-factor | os.environ everywhere |
| **pytest** + FastAPI TestClient | Tests | Whole workflow tested through the real API | unittest |
| **pytest-cov** (branch coverage) | Coverage gate | `fail_under = 95` fails the build when coverage drops | Coverage as a vanity number without a gate |
| **httpx2** (tests only) | HTTP client of Starlette's `TestClient` | Starlette 1.x deprecates `httpx` there; without it the type checker cannot resolve the client (653 Pyright errors) | Ignoring the deprecation |
| **pip-audit** | Known vulnerabilities in Python dependencies | Checks every pinned and transitive package against the PyPI advisory database; found real issues (D-26) | `safety` (commercial database) |
| **uv** | Lockfile generation | `uv pip compile --generate-hashes` produces `requirements.lock` with a hash for every transitive package | pip-tools (slower), Poetry (a second packaging system) |
| **Ruff** | Lint + format | One fast tool replaces flake8, isort, black | black + flake8 + isort |
| **Pyright (strict)** | Type checking | Same engine as Pylance in VS Code, so editor and CI agree | mypy |

### Frontend (TypeScript, React 19)

| Library | Used for | Why this one | Rejected alternative |
|---|---|---|---|
| **React + Vite 6** | UI | Standard, fast dev server. Vite is pinned to **6** because the dev machine runs Node 20.13 (Vite 8 needs ≥ 20.19) | Next.js (no SSR needed for an internal tool) |
| **TypeScript (strict)** | Language | `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, … | Plain JS |
| **TanStack Query** | Server state | Caching, loading/error states, invalidation with little code | Redux (overkill), manual `useEffect` fetching |
| **React Router** | Routing | De-facto standard | – |
| **Tailwind CSS 4** | Styling | Consistent design tokens, responsive utilities, no CSS files to maintain | CSS modules / component library (heavier) |
| **openapi-typescript** | API types | Generates types from the backend's Swagger schema, so front/back cannot drift | Hand-written interfaces |
| **ESLint + typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`** | Lint | Type-aware rules catch real bugs (`no-floating-promises`, `no-unsafe-*`) | Biome (faster, but type-aware rules less complete) |
| **eslint-plugin-react-hooks (v7)** | Hook rules | Also flags "copy props into state in an effect" – we removed those patterns | – |
| **Prettier** | Formatting | One formatter, no style debates | Mixing formatters |
| **Vitest 4 + jsdom 26** | Unit/component tests | Runs on the same Vite config as the app (no second build setup), fast. Vitest 4 because 3.x had a moderate advisory (`@vitest/mocker`); jsdom pinned to 26 because 27 needs Node >= 20.19 | Jest (separate transform pipeline, slower) |
| **Testing Library + user-event + jest-dom** | Component tests | Tests query by *role and label* like a user, so they survive refactors and double as accessibility checks | Enzyme / test-ids everywhere |
| **MSW (Mock Service Worker)** | API mocking in tests | Intercepts at the network layer, so the **real** API client code runs; `onUnhandledRequest: 'error'` forces every test to declare its requests | Mocking `fetch` / the client module |
| **Playwright + @axe-core/playwright** | End-to-end + accessibility | Real browser, auto-waiting, isolated contexts; axe scans each screen for WCAG 2.x A/AA violations | Cypress (slower, one browser family) |
| **eslint-plugin-jsx-a11y** | Static accessibility lint | Catches missing labels / non-semantic click targets before a browser is involved | - |
| **@tanstack/eslint-plugin-query** | Query lint | Exhaustive query keys, one stable `QueryClient` | - |
| **Knip** | Dead code | Finds unused files/exports/dependencies across the *whole* graph (ESLint only sees one file) | `ts-prune` (unmaintained) |

### Tooling / operations

| Tool | Why |
|---|---|
| **Docker + Compose** | One image serves API and built UI → matches "central web server, browser only, no client install". Dependencies are installed from the hash-locked file, the app runs as a non-root user, the health check uses the readiness endpoint (D-28). |
| **GitHub Actions** | Runs the same gates as local development on every push. |
| **Husky + lint-staged** | Git hooks: format/lint only the *staged* files on commit (fast), frontend checks on push. Configs live per folder so each tool runs in its own directory. |
| **commitlint (Conventional Commits)** | Readable history (`feat:`, `fix:`, `docs:` ...) enforced automatically; enables changelogs later. |
| **EditorConfig + `.gitattributes`** | Same indentation/line endings in every editor and OS (LF everywhere; avoids CRLF noise from Windows). |
| **Dependabot** | Weekly grouped update PRs for npm, pip, Actions and Docker; also raises security updates. |
| **Google Gemini (free tier)** | Free LLM with structured JSON output; behind a provider interface (see D-02). |

## 3. Coding standards

**Backend**
* Strict Pyright (`typeCheckingMode: strict`) with **0 errors**, tests included; no `Any` leaking from untyped libraries (local stub for PyMuPDF).
* **Ruff with a broad rule set**, not just style: bandit security rules (`S`), bugbear, simplify/comprehensions/performance, naming, unused arguments, no `print`, no commented-out code, timezone-aware datetimes, logging usage, pytest style, **FastAPI-specific rules** and pylint errors/warnings. Line length 120.
* Production code never relies on `assert` (it is stripped with `python -O`); optional values are handled explicitly.
* Routes are thin; logic lives in `services/`. Every endpoint has a typed return, a summary for Swagger, and is covered by a test.
* Permissions are enforced server-side with dependency aliases (`Translator`, `Reviewer`, `Admin`); every endpoint is tested for the 401/403 case.
* **Never trust input:** every request body has a Pydantic model with constraints (lengths, enums, patterns); uploads are size-limited, signature-checked and stored under random names; user-supplied file names are reduced to a base name and sanitised.
* Errors the user can fix are German messages with a precise status code (400/409/413/422/429); anything unexpected is a logged 500 with a request id and **no internals** in the response.
* **Configuration only through environment variables**, validated at start-up; production refuses insecure settings (D-23).
* The schema changes only through Alembic migrations; a test fails when a model changes without its migration (D-25).
* **Tests:** hermetic (explicit test environment, no network, no developer secrets), deterministic (fake clock for throttling), and written against behaviour: state machine, permissions, validation, failure paths (D-27).

**Frontend**
* No `any`, no non-null assertions (`!`), type-only imports, `eqeqeq`, no `console`.
* Server data via TanStack Query only; derive state instead of syncing it in effects.
* Non-component exports live in `src/lib/` (keeps React fast-refresh working and files focused).
* Generated code (`src/api/schema.d.ts`) is never edited by hand.
* **Accessibility is a gate, not a nice-to-have:** real `<button>`/`<label>` elements instead of `role` hacks, every form control has an accessible name, dialogs have `role="dialog"`, a title, Escape-to-close and focus handling, text meets WCAG contrast (>= 4.5:1), links inside text are underlined.
* **Tests:** query by role/label, never by CSS class; every network request a test makes must be declared in MSW (unknown request = test failure); mocks are restored after each test (`restoreMocks`).
* Side effects that tests must control (e.g. the session-expiry redirect) sit behind a small replaceable object (`session`), not hard-wired to `window.location`.
* Unused exports and dependencies fail CI (Knip); the pinned `typescript-eslint` version only changes deliberately.

## 4. Quality gates

| Gate | Command | Runs |
|---|---|---|
| Backend lint/format | `ruff check . && ruff format --check .` (security, bugbear, FastAPI, pytest, ... rules) | CI, pre-push |
| Backend types | `pyright -p ..` (strict) | CI, pre-push |
| Backend tests + coverage | `pytest` (287 tests, branch coverage 99 %, gate `fail_under = 95`) | CI, pre-push |
| Python dependency audit | `pip-audit -r requirements.lock` | CI |
| Lockfile freshness | `uv pip compile ...` then `git diff --exit-code requirements.lock` | CI |
| Container smoke test | build the image, start it, check readiness, non-root user and login | CI |
| Frontend types | `npx tsc -b` | CI |
| Frontend lint | `npm run lint` (typed, strict) | CI |
| Frontend build | `npm run build` | CI |
| Formatting | `npm run format:check` (Prettier) | CI |
| Dead code | `npm run knip` | CI |
| Unit + component tests | `npm run coverage` (50 tests, coverage guard) | CI, pre-push |
| Dependency audit | `npm audit --omit=dev --audit-level=high` (blocking, production dependencies) plus a non-blocking audit of dev tooling | CI |
| End-to-end + accessibility | `npm run e2e` (Playwright, real backend, axe on 11 screens/dialogs) | CI |
| Staged files | ESLint/Prettier (TS), Ruff (Python) | pre-commit |
| Commit message | commitlint, Conventional Commits | commit-msg |
| Frontend `check` + backend lint, types, tests | one script, about 1 minute | pre-push |

On commit only the staged files are formatted/linted (fast); the complete gates run before a push and again in CI.

## 5. Decision log

Format: **decision → why → alternatives → consequence**.

**D-01 · Scope (2026-09-30).** Core flow as a working prototype for **DE ↔ EN**; InDesign left for Phase 2.
*Why:* the spec itself lists InDesign under Phase 2 and `.imdd` is probably a typo for `.indd`; a polished core beats a broad shallow tool.
*Consequence:* upload rejects `.imdd/.indd` with a clear message.

**D-02 · LLM provider: Gemini free tier behind a provider interface (2026-09-30).**
*Why:* no paid API budget; the laptop (RTX 2060 6 GB) is too weak for good local models (Ollama rejected: slow, worse at JSON/glossary rules). Paid Claude/OpenAI APIs rejected on cost.
*Alternatives:* Ollama, DeepL (no term classification), paid APIs.
*Consequence:* provider can be swapped (Azure OpenAI EU, Ollama, DeepL) without touching the pipeline; an offline **mock** provider keeps tests free and deterministic.

**D-03 · Model alias + automatic fallback (2026-10-01).** Default `gemini-flash-lite-latest`, fallbacks `gemini-3.1-flash-lite`, `gemini-3-flash-preview`.
*Why (real failures):* `gemini-2.5-flash` returned **404 (retired)** and `gemini-3.8-flash` returned **503 (overloaded)**. Free-tier model names churn, so a fixed name is a demo risk.
*Consequence:* a batch is retried, then falls through to the next model; all attempts are logged.

**D-04 · Glossary enforced in code, not trusted to the LLM (2026-09-30).** Terms are matched *before* the call (passed as hard rules) and *verified after* (term must appear, re-checked after manual edits).
*Why:* an unconstrained model translated "Korpus" as "body"; for a company glossary "usually right" is not enough.

**D-05 · Segment pipeline with locators (2026-09-30).** Files are split into segments (paragraph / cell / PDF block) that remember their position.
*Why:* translation can be written back into the original Word/Excel so layout and formulas survive; it also enables per-segment regeneration, editing and comments.

**D-06 · Preview ≠ final (2026-09-30).** Translation creates a preview; approval stores an immutable **Release** (history); export requires approval.
*Why:* directly from the spec ("Erst nach Klick auf Freigabe …") and gives an audit trail (who, when, glossary version, number of changes).

**D-07 · Pydantic schemas as the API contract (2026-09-30).** `schemas.py` drives validation, responses and Swagger.
*Why:* far less code than hand-written serialisation and no drift between code and docs.

**D-08 · Frontend types generated from Swagger (2026-09-30).** `export_openapi.py` → `openapi-typescript`.
*Why:* a backend change that breaks the UI becomes a compile error, not a runtime surprise.

**D-09 · Strict typing everywhere (2026-09-30).** Pyright strict (654 → 0 errors), TS strict, typed ESLint.
*Details:* `langdetect` (untyped) replaced by a 15-line stopword detector for DE/EN; local stub for PyMuPDF; SQLAlchemy JSON columns typed via `type_annotation_map`.
*Why:* user requirement, and it catches whole bug classes before runtime.

**D-10 · One container serves API + UI (2026-09-30).** Multi-stage Dockerfile builds the React app and FastAPI serves it; Compose adds PostgreSQL.
*Why:* spec point 16 (central server, browser access, no client install) with a single command to deploy.

**D-11 · Pin Vite 6 (2026-09-30).** *Why:* Vite 8/Rolldown needs Node ≥ 20.19, the machine has 20.13.1; the native binary was silently not installed.

**D-12 · Derive state instead of syncing in effects (2026-09-30).** The strict React hooks rule flagged three `useEffect(() => setState(props))` patterns; replaced by derived values.
*Why:* removes cascading re-renders and stale-state bugs.

**D-13 · Keep ESLint + Prettier, not Biome (2026-10-01).** Research (see sources) shows Biome is faster but its type-aware rules are less complete. The project requirement is *strict typed linting*, so ESLint stays.

**D-14 - Frontend test pyramid (2026-10-01).** Logic and components: Vitest + Testing Library + **MSW**. Whole workflows: Playwright. 50 unit/component tests and 6 end-to-end tests.
*Why:* component tests are cheap and precise; only a real browser proves that upload -> preview -> approve -> export works end to end. MSW means the real API client is exercised, not a mock of it.
*Honest limit:* line coverage of unit tests is ~43% because the large page components are covered by Playwright instead; the threshold is a **regression guard**, not a quality claim.

**D-15 - Accessibility as a CI gate (2026-10-01).** `eslint-plugin-jsx-a11y` (static) + axe-core in Playwright (runtime, WCAG 2.x A/AA) on login, dashboard, upload, project (before/after translation), term dialog, quality panel, export dialog, project list, glossary, users and settings.
*Why:* an internal tool is still used by people with different needs, and enterprise customers increasingly require accessible software. Automation finds roughly a third to a half of issues, so it complements, not replaces, manual checks.
*Result:* it found real defects that were fixed (see section 6).

**D-16 - Git hygiene by automation (2026-10-01).** Husky + lint-staged (per-folder configs) + commitlint; pre-push runs the fast frontend checks.
*Why:* problems are cheapest to fix before they leave the developer's machine; only staged files are checked so commits stay fast.
*Alternative:* checking everything in CI only (slower feedback).

**D-17 - Dependency policy (2026-10-01).** Dependabot weekly (grouped minor/patch), `npm audit` in CI, `typescript-eslint` pinned exactly because its strict preset is not semver-stable, Vitest 4 to clear an advisory, jsdom 26 and Vite 6 for the Node 20.13 in use.
*Why:* reproducible builds and no known vulnerabilities, with upgrades as reviewed PRs instead of surprises.
*Exception (2026-10-03):* a new advisory for `braces` (denial of service through crafted glob patterns) affects **every** version, and reaches the project only through the dev tool Knip (`knip -> fast-glob -> micromatch -> braces`). No patched version exists and Knip 6 needs Node >= 20.19 (the machine has 20.13). Decision: the blocking CI audit covers **production** dependencies (what ships); dev-tooling advisories are reported without blocking. Revisit when Node is upgraded (then Knip 6).

**D-18 - Dead-code detection with Knip (2026-10-01).** It found an unused helper (`patch`) and two exports that nothing imported; all removed.
*Why:* unused code is maintenance cost and misleads readers; a graph-level tool finds what a per-file linter cannot.

**D-19 - Error boundary (2026-10-01).** A rendering crash shows a recovery message instead of a blank page; the class documents where to hook in a monitoring service.

**D-20 - Isolated end-to-end environment (2026-10-01).** Playwright starts its own backend on port 8765 with the mock translator and a throw-away database.
*Why:* tests must be deterministic, free (no Gemini quota) and must never touch a developer's or a deployed instance.

**D-21 - Backend professionalisation, researched first (2026-10-03).** Sources: FastAPI production guides, the OWASP Password Storage Cheat Sheet, Alembic's deployment recipes, Ruff's rule documentation, pytest-cov and Docker best-practice guides (section 9).
*Priorities chosen:* security first (passwords, headers, input limits, production guard), then reliability (migrations, restart recovery, readiness, logging), then verification (tests that found real bugs, coverage gate), then the supply chain (lockfile, audit, container).
*Not done on purpose:* Celery/Redis job queue and rate limiting in a shared store (one process is enough here; both are listed as next steps), async database access (sync SQLAlchemy is simpler and fast enough for an internal tool).

**D-22 - Passwords and login (2026-10-03).** Argon2id replaces PBKDF2 at 120k iterations. Old hashes still verify and are **upgraded transparently at the next login**. Unknown usernames cost the same time as wrong passwords (a dummy hash is always verified). Failed logins are limited per IP and username (5 in 15 minutes, `429` with `Retry-After`). Minimum password length 10. JWTs must carry `exp` and `sub`.
*Why:* OWASP lists Argon2id first and PBKDF2 needs 600k iterations; user enumeration by timing and online guessing are the classic login attacks.
*Honest limit:* the limiter is in memory (one process). Several workers need a shared store such as Redis.

**D-23 - Production refuses an insecure start (2026-10-03).** With `ENVIRONMENT=production` the app does not start unless `SECRET_KEY` is random and >= 32 characters and `SEED_DEMO_DATA` is off. A first administrator is created from `BOOTSTRAP_ADMIN_*` only when no user exists.
*Why:* the demo accounts have well-known passwords and the development secret is public in this repository; a misconfigured deployment must fail loudly, not run insecurely.

**D-24 - HTTP hardening and observability (2026-10-03).** Security headers on every response (CSP with `frame-ancestors 'none'` and no `unsafe-eval`, `nosniff`, frame denial, referrer and permissions policies, optional HSTS); CORS reduced to the needed methods and headers; a request id on every response and log line; JSON logs for log collectors; a last-resort error handler that logs the exception and returns only the request id; liveness (`/api/health`) and readiness (`/api/ready`, checks the database) endpoints. Uploads: size limit (413), file-signature check, random stored names, sanitised names.
*Why:* defence in depth; a request id lets a user report "request 3f9a..." and the operator finds the exact log line.
*Verified:* the Playwright suite runs with a console guard, so a CSP violation fails the build; the end-to-end tests pass under the strict policy.

**D-25 - Alembic migrations instead of `create_all` (2026-10-03).** One baseline migration; the app upgrades at start-up (`AUTO_MIGRATE`, switchable for a separate deploy step). Databases created by the first version are *adopted* (stamped) instead of failing with "table exists". Tests: upgrade, repeat upgrade, downgrade, offline SQL, adoption of a legacy database, and a **drift test** that fails when a model changes without a migration.
*Verified* on SQLite and on PostgreSQL in Docker, including the legacy adoption (data survived).

**D-26 - Supply chain (2026-10-03).** `requirements.lock` pins **every transitive package with a hash** (`uv pip compile --generate-hashes`); Docker and CI install it with `--require-hashes`. `pip-audit` runs in CI. The first audit found real vulnerabilities: **Starlette 0.41 (14 advisories, fix needs 1.x -> FastAPI 0.115 -> 0.142)**, **PyJWT 2.10 (20 advisories -> 2.15)** and **python-multipart 0.0.20 (12 advisories -> 0.0.31)**. All upgraded, 287 tests still green, audit clean. CI also fails when `requirements.txt` changed without regenerating the lock.
*Why:* a version number alone does not prove what gets installed; hashes do.
*Consequence:* Dependabot PRs for `requirements.txt` need `uv pip compile ...` to refresh the lock (CI says so).

**D-27 - Backend test strategy (2026-10-03).** From 6 tests / 80 % to **287 tests / 99 % branch coverage** with a 95 % gate. Areas: authentication and tokens, rate limiter (fake clock), security headers and request ids, production guard, uploads, parsing, the glossary matcher, the quality check, the Gemini provider (retry, fallback, throttle - with a faked HTTP layer), the translation pipeline and its failure paths, restart recovery, migrations, the whole review workflow (state machine and permissions), every export format and mode, glossary management and Excel import, projects (search, copy, delete), admin endpoints.
*Hermetic by construction:* the test environment overrides every secret and setting, and a fixture **fails any test that attempts a real HTTP call** (this exists because one test once reached the real Gemini API with a developer's key, see section 6).
*Result:* writing them surfaced 8 real defects, some by failing tests, some by reviewing the code paths while designing them (section 6).

**D-28 - Container hardening (2026-10-03).** Dependencies from the hash-locked file; the app process runs as an unprivileged user (uid 10001). The entrypoint starts as root only to repair the ownership of the data volume (volumes from the old root-running image keep working), then drops privileges. Health check uses the readiness endpoint. Compose reads secrets from the environment, restarts the services, logs as JSON.
*Verified in an isolated stack:* PID 1 runs as uid 10001, a root-owned legacy volume is repaired, PostgreSQL migrations run, a complete workflow works. CI repeats the build, start and non-root check.

**D-29 - Stricter input contracts (2026-10-03).** The Excel layout is a validated model (column letters within A-XFD, no column used twice, Excel's 31-character sheet-name limit and forbidden characters), languages are literals, project changes have length limits, lists have limits (`limit` 1-1000). Invalid input is a clear `422` instead of a crash or silent acceptance. Because the frontend types are generated from the schema, the UI picked these up with a recompile.

## 6. Problems found and how they were fixed

| Problem | Cause | Fix |
|---|---|---|
| Pyright: 654 errors | Untyped `dict`/`list` columns and missing stubs cascaded | Typed JSON columns, Pydantic schemas, stubs; 0 errors |
| Article numbers came back as `Uk-4711/60` | Mock translator capitalised unknown words | Mock leaves unknown words untouched |
| Build crashed ("Cannot find native binding") | Vite 8 needs newer Node | Pinned Vite 6 (D-11) |
| Gemini 404 / 503 | Retired and overloaded models | Alias + fallback (D-03) |
| Everyday words tagged as "technical terms" | Prompt too permissive | Prompt restricted to industry-specific terms |
| Mobile rows did not say which block is the translation | Column header hidden on small screens | Added a small label |
| `jsdom 27` crashed under Node 20.13 (`ERR_REQUIRE_ESM`) | Its dependencies are ESM-only; needs Node >= 20.19 | Pinned jsdom 26 |
| Vitest 3 had a moderate advisory | `@vitest/mocker` path traversal | Upgraded to Vitest 4.1 (0 vulnerabilities) |
| A test failed only when run after another | A spy was never restored and leaked into the next test | `restoreMocks: true` globally |
| Session-expiry redirect untestable | Hard-wired to `window.location.assign` (not spy-able in jsdom) | Small replaceable `session` object |
| **Accessibility: highlighted terms were `<mark role="button">`** | Role hack instead of a real control | Real `<button>` elements |
| **Accessibility: dialogs** | No dialog semantics, no keyboard close | `role="dialog"`, `aria-labelledby`, Escape, focus handling |
| **Accessibility: scrollable lists unreachable by keyboard** | Nested `overflow-y-auto` boxes | Removed nested scrolling |
| **Accessibility: 76 low-contrast texts** | `text-slate-400/500` below 4.5:1 | Darker muted colour |
| **Accessibility: unlabeled inputs/selects, colour-only link** | Placeholder-only controls | `aria-label`s, underlined link |
| E2E suite deleted its own database | Playwright re-evaluates the config in every worker | One temp dir shared via an environment variable |
| E2E run used a stale UI | Tests run against the built app | `npm run e2e` always builds first |
| **First push: CI failed, a fresh clone could not build** | The Python `.gitignore` template rule `lib/` also matched `frontend/src/lib/`, so 7 source files were never committed (everything worked locally) | Anchored the rule (`/lib/`); verified with a fresh `git clone` running every frontend gate. Lesson: always verify from a clean clone |
| Pre-commit ESLint could not find its config | lint-staged ran from the repo root | Per-folder lint-staged configs |
| Page declared `lang="en"`, title "frontend", Vite favicon | Template defaults never replaced | `lang="de"` (screen readers pronounce German correctly), real title and description, own favicon, unused template asset removed |
| **Backend bug (found by a test): "text identical to the original" never fired** for segments without terms | `all([])` is `True`, so `not all(...)` was `False` | `terms and all(...)`; an untranslated paragraph is now flagged |
| **Backend bug: editing a language with no translation yet returned 500** | A new ORM object has `terms = None` until it is flushed | `Translation.empty(lang)` creates objects with real defaults |
| **Backend bug: a source-language "target" made approval impossible** | Translation skipped it, approval and quality check still required it | One definition, `Project.targets` (targets minus the source language) |
| **Backend bug: exports of two projects with the same file name overwrote each other** | Stored under `<filename>_<lang>_<mode>`; history still listed both | Unique stored names (uuid), sanitised readable download names |
| **Backend bug: deleting a project left its export files on disk** | Only database rows and the upload were removed | Export files are deleted as well |
| **Backend gap: old versions could not be read** (history stored preview and final text, no endpoint returned them) | Endpoint was lost in a refactoring | `GET /api/releases/{id}` |
| **Backend bug: restart left projects "running" forever** | Background threads die with the process | Start-up marks interrupted jobs as failed with a clear message |
| **Backend bug: invalid Excel layout (`{"target_col": "1"}`) caused a 500** | Free-form dict | Validated `ExcelLayout` model, 422 |
| Glossary import accepted any text as category | No validation | Only `technical`/`product`, otherwise default |
| A test called the real Gemini API | The app reads the developer's `.env`, which contains a real key | Test environment overrides all settings; any real HTTP call in a test fails |
| Windows error `environment variable is longer than 32767 characters` | Parametrized tests passed whole files as arguments, so pytest built giant test ids | Short explicit ids |
| Pyright: 653 errors after upgrading FastAPI | Starlette 1.x `TestClient` needs `httpx2`, types could not be resolved | `httpx2` as a test dependency |
| `pip-audit`: vulnerabilities in Starlette, PyJWT, python-multipart | Old pinned versions | Upgraded (D-26) |
| PyJWT warned about a 9-byte signing key in tests | A short key from a copied `.env` example | Tests set their own 40-character key; `.env.example` no longer ships a weak value |
| Container could not write to an existing data volume after switching to non-root | Volume created by the old root image | Entrypoint repairs ownership, then drops privileges (D-28) |
| Container without PostgreSQL could not create its SQLite file | Default path derived from the repository layout, which does not exist in the image | Default derived from `DATA_DIR` |
| Ruff `ERA001` flagged decorative comment lines | Separator comments look like code | Plain comments |

## 7. Status and roadmap

**Done:** all 17 sections of the specification except InDesign (see README coverage table).

**Done - frontend professionalisation (2026-10-01):** tests (Vitest, Testing Library, MSW), Playwright end-to-end with axe, `jsx-a11y`,
TanStack Query lint, Knip, `prettier --check` + `npm audit` in CI, Husky + lint-staged + commitlint, EditorConfig, Dependabot, error boundary.

**Done - backend professionalisation (2026-10-03):** broad Ruff rule set, 287 tests at 99 % branch coverage with a gate, Argon2id and login rate limiting, production configuration guard, security headers and CSP, request ids and JSON logs, readiness endpoint, upload hardening, Alembic migrations with legacy adoption, restart recovery, hash-locked dependencies with `pip-audit`, non-root container with CI smoke test, pre-push gates for both sides.

**Known limits (honest list):**
* The new CI jobs (container smoke test, `pip-audit`, lock freshness) were verified locally step by step but have not yet run on GitHub.
* The login limiter is in memory (one process); background translations run in threads of the web process (no queue, no cancellation, no resume after a restart - the project is marked failed and can be restarted).
* Tokens are bearer tokens in browser storage: there is no revocation or refresh. The strict CSP reduces the XSS risk but a short expiry plus refresh tokens would be the next step.
* There is no separate audit-log table beyond the release/export history and the logs.
* Frontend: unit-test line coverage is about 43 % (pages are covered by the end-to-end suite); the history screen does not show released versions yet although `GET /api/releases/{id}` exists; no screen-reader test; API responses are not validated at runtime (types are compile-time only).
* Dev-tool advisory without a fix (`braces` via Knip) is reported but not blocking (D-17); Starlette's deprecation of `httpx` in its test client is handled by `httpx2`.

**Not planned for this task:** InDesign, OCR, translation memory (Phase 2 in the spec).

## 8. Changelog

* **2026-09-30** – Initial implementation: backend, frontend, glossary, quality check, export, Docker, CI, tests.
* **2026-10-01** – Real Gemini integration verified; model alias + fallback (D-03); prompt tightened; PDF and EN → DE verified.
* **2026-10-01** – This engineering log created; frontend research completed (sources below).
* **2026-10-03** - First push to GitHub (public repository; secrets scanned before committing, task PDFs and `.env` excluded). CI caught a `.gitignore` bug (missing `frontend/src/lib`), fixed and verified from a fresh clone; audit gate split into blocking (production) and informational (dev tooling).
* **2026-10-01** – Frontend professionalised: 50 unit/component tests, 6 Playwright tests incl. axe accessibility scan on 11 screens, `jsx-a11y`, TanStack Query lint, Knip, error boundary, Husky/lint-staged/commitlint, EditorConfig, Dependabot, stricter CI. Fixed the accessibility defects the scan found.
* **2026-10-03** - Backend professionalised (D-21 to D-29): research, broad Ruff rules, security hardening, migrations, restart recovery, 287 tests at 99 % coverage (surfaced 8 real defects), hash-locked and audited dependencies (upgraded FastAPI/Starlette, PyJWT, python-multipart), hardened container, extended CI and pre-push hook, console guard and security-header tests in the end-to-end suite.

## 9. Sources (research, 2026-10-01 and 2026-10-03)

* typescript-eslint – [shared configs](https://typescript-eslint.io/users/configs/) (note: `strict-type-checked` is not semver-stable → pin the version)
* Playwright – [best practices](https://playwright.dev/docs/best-practices)
* TanStack Query – [ESLint plugin](https://tanstack.com/query/latest/docs/eslint/exhaustive-deps)
* [Knip](https://knip.dev/) – unused files, exports and dependencies
* Backend: OWASP - [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) (Argon2id first; PBKDF2 needs 600,000 iterations) - primary source
* Backend community guides (lower authority, used where several agree): [FastAPI production-ready applications](https://oneuptime.com/blog/post/2026-01-26-fastapi-production-ready/view),
  [FastAPI project structure and security headers](https://dev.to/datanestdigital/production-ready-fastapi-project-structure-2026-guide-b1g),
  [Ruff rule codes (S, B, PT, ...)](https://pydevtools.com/handbook/explanation/what-do-ruff-rule-codes-mean/),
  [Alembic migrations in production](https://github.com/sqlalchemy/alembic/discussions/901),
  [pytest-cov and coverage thresholds](https://pydevtools.com/handbook/how-to/how-to-measure-code-coverage-with-pytest-cov/),
  [Python Docker best practices](https://testdriven.io/blog/docker-best-practices/)
* Community roundups (lower authority, used only where several agree): [React best practices 2026](https://dev.to/nozibul_islam_113b1d5334f/react-best-practices-2026-2ng2),
  [Biome vs ESLint vs Oxlint](https://www.pkgpulse.com/guides/biome-vs-eslint-vs-oxlint-2026),
  [Testing React apps in 2026](https://nirajiitr.com/blog/react-testing-2026-vitest-rtl-msw),
  [axe-core + Playwright in CI](https://rishikc.com/articles/accessibility-testing-ci-integration/),
  [Husky + lint-staged](https://dev.to/_d7eb1c1703182e3ce1782/git-hooks-with-husky-and-lint-staged-the-complete-setup-guide-for-2025-53ji),
  [Dependabot vs Renovate](https://appsecsanta.com/sca-tools/dependabot-vs-renovate)
