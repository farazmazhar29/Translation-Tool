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
| **Pydantic v2** | Validation, API contract (`<feature>/schemas.py`) | One typed source of truth for input validation, output shape and the docs | Hand-written dicts |
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
| **openapi-generator (`typescript-axios`, in Docker) + axios** | API client | Generates typed functions per endpoint (`ProjectsApiFactory(API_CONFIG).getProjectDetail({ pid })`) and the models from the backend's Swagger schema, so front/back cannot drift; Docker instead of its npm wrapper, which needs Java and pulled 16 audit findings into the dev tools (D-58) | openapi-typescript (types only, hand-written fetch calls), hand-written interfaces |
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
* Routes are thin; logic lives in the `service`/`pipeline` modules of the feature. Every endpoint has a typed return, a summary for Swagger, and is covered by a test.
* Permissions are enforced server-side with dependency aliases (`Translator`, `Reviewer`, `Admin`); every endpoint is tested for the 401/403 case.
* **Never trust input:** every request body has a Pydantic model with constraints (lengths, enums, patterns); uploads are size-limited, signature-checked and stored under random names; user-supplied file names are reduced to a base name and sanitised.
* Errors the user can fix are German messages with a precise status code (400/409/413/422/429); anything unexpected is a logged 500 with a request id and **no internals** in the response.
* **Configuration only through environment variables**, validated at start-up; production refuses insecure settings (D-23).
* The schema changes only through Alembic migrations; a test fails when a model changes without its migration (D-25).
* **Tests:** hermetic (explicit test environment, no network, no developer secrets), deterministic (fake clock for throttling), and written against behaviour: state machine, permissions, validation, failure paths (D-27).

**Frontend**
* No `any`, no non-null assertions (`!`), type-only imports, `eqeqeq`, no `console`.
* **The backend is called only through services (D-58):** each feature has `api/<Name>Service.ts` (`ProjectService`, `GlossaryService` ...) with `useFetch…` hooks for reading (`useApiRequest`: data, loading, error) and mutation hooks or plain functions for changes. Every URL appears once, in the generated client; components never build a request. Derive state instead of syncing it in effects.
* Non-component exports live in a `lib/` folder (keeps React fast-refresh working and files focused).
* Generated code (`src/shared/api/generated/`) is never edited by hand; `npm run openapi:generate-specs` rewrites it.
* **Feature-based structure (D-32):** code is grouped by feature (`src/features/<name>/`), code used by several features lives in `src/shared/`; a feature is imported through its `index.ts` only, and `shared/` never imports a feature. Both rules are enforced by ESLint.
* **Accessibility is a gate, not a nice-to-have:** real `<button>`/`<label>` elements instead of `role` hacks, every form control has an accessible name, dialogs have `role="dialog"`, a title, Escape-to-close and focus handling, text meets WCAG contrast (>= 4.5:1), links inside text are underlined.
* **Tests:** query by role/label, never by CSS class; every network request a test makes must be declared in MSW (unknown request = test failure); mocks are restored after each test (`restoreMocks`).
* Side effects that tests must control (e.g. the session-expiry redirect) sit behind a small replaceable object (`session`), not hard-wired to `window.location`.
* Unused exports and dependencies fail CI (Knip); the pinned `typescript-eslint` version only changes deliberately.
* **Reuse before repetition:** forms are built from `shared/components/form.tsx` (`TextField`, `TextArea`, `SelectField`, `Checkbox`, `TargetLanguage`; `onChange` receives the value, never the DOM event) and `shared/components/layout.tsx` (`PageHeader`, `Table`, `Form`, `Loading`, `EmptyState`); form state uses `useFields` (`shared/lib/hooks.ts`), API state the services (`useApiRequest`, `useMutation` from `shared/api/base.ts`). A page does not write its own `<label><input>`, `<table>` shell or TanStack boilerplate.
* **One function style:** `const` + arrow functions everywhere (components, hooks, helpers, tests), enforced by ESLint (`func-style`, `prefer-arrow-callback`, `no-use-before-define`). Classes (the error boundary) are exempt: React has no hook for error boundaries.

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
| Unit + component tests | `npm run coverage` (109 tests, about 57 % statement coverage, coverage guard) | CI, pre-push |
| Dependency audit | `npm audit --omit=dev --audit-level=high` (blocking, production dependencies) plus a non-blocking audit of dev tooling | CI |
| End-to-end + accessibility | `npm run e2e` (Playwright, 10 tests, real backend, axe on 11 screens/dialogs, German and English) | CI |
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

**D-07 · Pydantic schemas as the API contract (2026-09-30).** The `schemas.py` of each feature drives validation, responses and Swagger.
*Why:* far less code than hand-written serialisation and no drift between code and docs.

**D-08 · Frontend types generated from Swagger (2026-09-30).** `export_openapi.py` → `openapi-typescript`. Replaced by a generated client in D-58.
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

**D-30 - Arrow functions everywhere in the frontend (2026-10-03).** All 34 `function` declarations became `const` arrow functions; ESLint enforces it (`func-style: expression`, `prefer-arrow-callback`, `@typescript-eslint/no-use-before-define`).
*Why:* one syntax for components, callbacks, hooks and helpers (the code had both styles mixed); `const` cannot be reassigned; arrow functions are not hoisted, so a name can never be used before its definition (the compiler reports it).
*Honest trade-offs:* hoisting rarely causes real bugs in modules, and React's own documentation still uses function declarations, so this is a team style choice, not a technical necessity. `export default` needs two lines (`const X = ...` then `export default X`), and generic components in `.tsx` would need the `<T,>` form (none exist).
*Verified:* types, lint, formatting, Knip, 50 unit tests, the production build and all 8 browser tests are unchanged and green; the new rules were shown to fail on deliberately bad code.

**D-31 - Reusable form and layout components (2026-10-03).** The same markup was written by hand 30+ times (a label, an input and a three-line `onChange` handler; three identical table shells; eight page headers; thirteen `useMutation` + invalidate blocks). It is now `TextField`/`SelectField`/`Checkbox`/`LangCheckboxes`, `Table`, `PageHeader`, `Form`, and the hooks `useAction` and `useFields`.
*Honest numbers:* the pages and dialogs that use them shrank by about **385 lines (-18 %)**, but the shared building blocks cost about **280 lines**, so the net saving is only **roughly 80-100 lines**. The gain is not mainly size: the markup now exists once, a style change is one edit, forms are shorter and declarative, and every control gets its accessible name from the same place.
*Side effects, all improvements:* selects and text areas that had no accessible name now have one; the target-language checkboxes are a real `fieldset` with a `legend` (before: a label wrapped around other labels); in the new-project form, unchecking a language now starts from the *shown* selection instead of the hidden default.
*Not extracted on purpose:* single-use pieces (dashboard tiles, the segment row, the Excel layout fields) and a configurable data table (the cells differ too much; a thin `Table` shell is clearer).
*Tests:* every new component and hook has its own unit tests (value-based `onChange`, labels, hidden labels, empty/loading table states, form submission and error, invalidate-then-`onSuccess` order, state updates); the existing tests were checked against the new markup.

**D-32 - Feature-based file structure (2026-10-03).** The code was grouped by file type (`pages/`, `components/`, `lib/`), so one change (for example to the glossary) touched three folders. It is now grouped by feature: `app/` (shell: router, providers, entry point), `features/{auth,projects,glossary,users,settings}/` (pages, components and helpers of one feature together; `pages/`, `components/` and `lib/` subfolders only where a feature has enough files), `shared/` (UI components, hooks and the API client used by several features) and `testing/` (test infrastructure: setup, mock server, fixtures, render helper). Tests are not mixed with the code: every module has its own `tests/` folder (`features/<name>/tests/`, `shared/tests/`, `app/tests/`). Why: a feature can be read, changed, moved or deleted as one unit, and dependencies become visible. Rules, enforced by ESLint (`no-restricted-imports`): other code imports a feature through its `index.ts` only (its public API), and `shared/` must not import features or the app shell, so dependencies point one way. The `@/` alias (Vite + `tsconfig` paths) replaces `../../` chains. Moved with `git mv`, so file history is kept. Alternatives considered: a separate layer folder per feature (`hooks/`, `api/`, `types/` in each) - rejected as more nesting than an app of this size needs; the `eslint-plugin-boundaries` plugin - rejected as an extra dependency for two simple rules.

**D-33 - Constants in `constants.ts` files (2026-10-03).** Labels, option lists, colour maps and other fixed values were spread over the API client, `lib/entry.ts` and the top of eight components. They now live in one `constants.ts` per module: `shared/constants.ts` (labels of API values used by several features: languages, project states, term categories, export formats and modes), `features/<name>/constants.ts` (values used only inside that feature) and `app/constants.ts` (navigation). The API client contains HTTP code only. No TypeScript `enum`s on purpose: the value sets come from the generated OpenAPI types (`S['UserOut']['role']`, `Lang`), so the backend stays the single source of truth, and `enum` is not allowed by `erasableSyntaxOnly` (it generates runtime code, which Node's type stripping and Vite's per-file transpilation handle badly).

**D-34 - Internationalisation: German and English (2026-10-03).** All visible text was hard-coded German. The interface now uses `i18next` + `react-i18next` (the de-facto standard for React; supports interpolation, plurals and switching without a reload) with the detector plugin. Language order: the user's last choice (stored in `localStorage`), then the browser language, **fallback English**; only `de` and `en` are supported and `de-DE` maps to `de`. A DE/EN switch sits in the header, `<html lang>` follows the active language, and dates use `Intl` with the active language (`fmtDate`). Texts live next to their module: `shared/i18n/common/{de,en}.ts` (namespace `common`: buttons, statuses, categories, roles, navigation) and `features/<name>/i18n/{de,en}.ts` (one namespace per feature), registered in `app/i18n.ts`. **Type safety:** `de.ts` is the reference and `en.ts` is declared as `Texts<typeof de>`, so a missing or extra key is a compile error; i18next's `CustomTypeOptions` types `t('ns:key')`, so a typo in a key does not compile. Constants hold keys and styles only (`STATUS_STYLE`, `LANGS = ['de', 'en']`), the labels are translations (`common:status.new`, `common:lang.de`). `optionsOf(values, label, ...leading)` builds `<select>` options from a value list and a label function. The unit tests run in German (`i18n.changeLanguage('de')` in the test setup) and the Playwright suite sets `locale: 'de-DE'`, so both keep reading the German texts.
*Honest limits:* messages that the backend sends (validation errors, quality-check messages) are still German; translating them needs error codes in the API, which is a backend task. Translation *content* (what the user translates) is of course unaffected.

**D-35 - `ProjectView` split into parts (2026-10-03).** The project screen was one 552-line file (translation setup, review workflow, quality panel, history panel and the segment rows). It is now a 144-line page that holds the state (selected language, open panel, dialogs) and the single API runner, plus eight components in `features/projects/components/`: `ProjectHeader`, `TranslationSetup`, `ProjectToolbar`, `TermLegend`, `QualityPanel`, `HistoryPanel`, `SegmentTable`, `SegmentRow` (none longer than 146 lines). Rules followed: a part owns the state only it needs (`TranslationSetup` the language choice, the panels their own query, which now runs only while the panel is open), shared types live in `features/projects/types.ts`, and every API call that changes the project goes through one `run` function, so the "please wait" dialog and the refresh stay in one place. Behaviour is unchanged. New unit tests cover the toolbar (which button each role sees in each status), the segment row (edit, cancel, regenerate, read-only) and the quality panel.

**D-36 - Full test run and polish after the refactoring (2026-10-03).** All of D-30 to D-35 was first checked only statically (types, lint, Knip, build), as agreed; the tests were run at the end: 109 unit/component tests (was 50) and 10 Playwright tests (was 8), all green. Two failures were found and fixed, both in a test I had just written (it did not wait for the asynchronous login before looking for role-dependent buttons); no production code needed a change. Added: (1) an end-to-end spec for the interface language (an unsupported browser language gets English; the switch works, is remembered after a reload and sets `<html lang>`); (2) `i18n-keys.test.ts`, which fails when a German text has no use in the code (checked by temporarily adding a dead key); it reads the sources with `fs`, not `import.meta.glob`, because loading sources through Vite hid the untested files from the coverage report and inflated it from 57 % to 81 %, which was caught and corrected; (3) lazy loading of the pages with `React.lazy` + `Suspense` (each feature becomes its own chunk). *Honest result:* lazy loading only reduced the first download from 432 kB to 397 kB, because most of the weight is libraries (React, Router, TanStack Query, i18next), not pages. The coverage guard was raised from 40/40/30/30 to 55/55/45/48 (lines/statements/functions/branches), just below the measured 58/57/50/51.

**D-37 - Review of component state (2026-10-03).** Every `useState`, `useEffect`, `useRef`, `useMemo` and `useCallback` was reviewed with the question "could this be derived or merged?". Result: the code was already lean (28 `useState`, one `useEffect` for the dialog's Escape listener, no `useMemo`/`useCallback` because nothing needs them), and four places were simplified: the login form and the new-project form keep their text fields in one `useFields` record instead of 2 and 4 separate states; the segment row has one `draft` state (`null` = not editing) instead of `editing` + `draft`, which also removes the state "editing without a draft"; the project screen has one `modal` state (term dialog, export dialog or none) instead of `dialog` + `exporting`, so two dialogs can no longer be open at once. Kept on purpose: the "picked" values in `TranslationSetup` and `ProjectView` (`null` until the user chooses, otherwise derived from the server data, so nothing has to be synchronised in an effect), and the import/duplicate-scan message in the glossary (two actions share one message line).

**D-38 - Backend: one place for every fixed set of values (2026-10-04).** About 130 string literals (`"approved"`, `"translator"`, `"preview_ready"`, `"technical"` ...) were spread over 14 files, with the allowed values only written in comments (`# new | preview_ready | ...`) and the same list repeated in several `Literal[...]` types (the role list twice, the languages three times, with a comment "keep in sync"). They are now `StrEnum`s in `app/enums.py`: `Role` (with a `rank`, replacing a separate dict), `ProjectStatus`, `JobState`, `Lang`, `GlossaryStatus`, `EntryCategory`, `GlossaryAction`, `TermCategory`, `Severity`, `FileFormat` (uploads and exports), `ExportMode`, `ArchiveFilter`, `Provider`, plus the sets `EDITABLE_STATUSES` and `FINISHED_STATUSES`. Why `StrEnum` and not plain constants: members *are* strings (compare equal, serialise to the same JSON), Pydantic validates against them, Swagger shows them as `enum`, and Pyright now rejects a typo or a wrong value. **Database:** a small `Choice` column type (`db.py`) stores the enum as its value in the same plain `VARCHAR`, so the schema and the Alembic migrations are unchanged (the migration tests still pass); values outside the enum are rejected on write and on read. **API:** the contract is stricter and better documented (`status`, `role`, `category`, `format`, `mode` are enums in the OpenAPI schema); the frontend types were regenerated and several casts there became unnecessary. *One visible change:* an invalid glossary status in `POST /api/glossary/{id}/status` is now rejected by request validation (422) instead of by hand-written code (400). *Kept as text on purpose:* language columns (they also hold `auto` and the empty "not detected"), the JSON settings, and the LLM provider stored in the settings page. Verified: Ruff, Pyright strict (0 errors), 287 tests at 99 % coverage, 109 frontend unit tests, 10 Playwright tests.

**D-39 - Backend: structure by feature (2026-10-04).** The backend was layered by file type (`routers/`, `services/`, one `models.py`, one `schemas.py` of 313 lines), so a change to e.g. the glossary touched five folders, and `workflow.py` mixed translation, editing, quality, approval, export, history and templates in one 276-line router. It is now grouped by feature, like the frontend: `core/` (configuration, database, enums, logging, middleware, migrations, rate limiter: no domain code), `accounts/` (users, login, tokens, roles), `projects/` (projects, segments, upload parsing, language detection), `glossary/`, `translation/` (LLM providers, the translation pipeline), `quality/`, `review/` (approve, reject, reopen, releases, history), `export/` (Word/Excel/PDF, templates), `preferences/` (settings page), `dashboard/`. Each feature owns its `models.py`, `schemas.py`, `router.py` and, where it has logic, `service.py`; shared lookups are in `projects/queries.py`. Imports are absolute (`from app.glossary.service import ...`). `app/registry.py` imports every model so Alembic and tooling see all tables. `core` imports nothing from the features; every feature may use `core` and `accounts` (login and roles). Between features the dependencies are: `glossary` <- `projects` <- `translation`/`quality` <- `review`/`export`/`dashboard`; the exceptions are that deleting a project also deletes its releases and export files (`projects` uses their models) and that `review` and `export` use each other's models (history lists exports, exports record the latest release). There are no import cycles between *modules* (checked with a script over the import graph). **Unchanged:** the HTTP API (same 38 paths and the same schemas, verified by comparing the generated OpenAPI documents; only the Swagger tags and the order of the paths differ), the database schema and the 287 tests (only their imports changed). Tests stay together in `backend/tests/` (they are API-level and span features), separate from the application code. *Honest limit:* the packages are not strictly layered (see the exceptions above); a tool like import-linter could enforce the direction if the project grows.

**D-40 - Database constraints (migration 0002, 2026-10-04).** A review of the real PostgreSQL schema showed that the first migration only had what SQLAlchemy creates by default (primary keys, `NOT NULL`, one unique, four foreign keys without delete rules); everything else was enforced by application code only. Migration `0002_database_constraints` moves the rules into the database, so they also hold for direct SQL, scripts and future code: **CHECK constraints** for every enum column (`ck_<table>_<column>`; a test fails when a new enum column has none) and for ranges (`job_progress` 0-100, `segments.idx >= 0`, `glossary_entries.version >= 1`, `releases.change_count >= 0`); **UNIQUE** `(project_id, idx)` on segments and `(segment_id, lang)` on translations; **foreign keys with `ON DELETE CASCADE`** (project -> segments -> translations, releases, exports) so a delete cannot leave orphans; `export_files.release_id` is now a real optional foreign key (`ON DELETE SET NULL`, `NULL` instead of the magic value `0`; the API field is `int | null`); an index for the project list (`archived`, `updated_at`) and one for the new foreign key; the two plain indexes that the unique constraints make redundant are dropped. SQLite now enforces foreign keys too (`PRAGMA foreign_keys=ON`), so the test database behaves like PostgreSQL. **Data safety:** the migration first repairs data the new rules would reject (duplicate translations keep the newest, unknown release ids become `NULL`); the enum values in it are frozen copies, so a later enum change cannot rewrite history. Legacy databases from the first version are stamped as `0001` and then upgraded. **Verified:** on SQLite (tests) and on a copy of the real PostgreSQL database (upgrade, `alembic check` without drift, downgrade, upgrade again, data intact); 10 new tests check that the database itself rejects invalid values, duplicates and orphans, and that cascades and `SET NULL` work. *Not done on purpose:* `JSONB` instead of `JSON` (nothing queries inside the JSON, and it would make PostgreSQL and SQLite diverge), time-zone-aware timestamps (all code uses naive UTC consistently), foreign keys from the `created_by`/`edited_by`/`approved_by` text columns to `users` (they deliberately keep the name of the person at the time), and length limits on text columns.

**D-41 - Backend: no N+1 queries (2026-10-05).** Question: "is the backend lazy loaded?" Python modules are imported at start-up (normal for a long-running server; cold start about 2 s, nothing to gain), but SQLAlchemy *relationships* were loaded lazily, which causes the classic N+1 problem: opening a project cost one query for the project, one for its segments and **one more per segment** for its translations (measured: 400 segments = 403 SQL statements, 160 ms on local SQLite; every statement is a network round trip with PostgreSQL). `Segment.translations` is now loaded with `lazy="selectin"` and `get_project` loads the segments with `selectinload`: 400 segments = 4 statements, 29 ms, and the same for the quality check, approval, export and copy, which all go through `get_project`. Project *lists* are unaffected (they do not load segments). A test counts the statements for 60 segments (63 before, at most 8 now) so that the problem cannot return unnoticed. *Not done:* the glossary list and the duplicate check still load every entry into Python (fine for hundreds of entries, not for tens of thousands).

**D-42 - Visual design (2026-10-05, first step).** The interface was a plain Tailwind default. Reference: the Rotpunkt web site (read with a browser: typeface **Raleway**, body colour `#212121`, one brand red `#E30421` for logo dot, buttons and menu, pill-shaped buttons, a dark warm photographic style) and the company's LinkedIn page (tone: warm, premium, "welcome home"). Decisions: a *light work surface* with the brand as accent (a work tool is read for hours; the dark hero style of the marketing site is used only on the sign-in panel); Raleway self-hosted with `@fontsource-variable/raleway` (the strict CSP allows no external fonts; digits switched to lining figures because Raleway defaults to old-style numerals), body weight 450 (the site uses 300, too light for a tool); design tokens in `app/index.css` (`brand`, `ink`, `canvas`, `line`, `night`) so no colour is repeated in components; warm greys (`stone`) instead of blue-greys; error red stays separate from brand red; icons from `lucide-react` (tree-shaken, MIT). Structure: left navigation (a drawer with a round menu button on phones, like the site), user card and language switch at its foot; the dashboard has a greeting, one primary action and KPI cards; the project screen shows a four-step workflow indicator, a grouped toolbar and cleaner segment rows; status is a coloured chip with a dot. *Accessibility gate:* the axe test caught three real contrast failures in the new palette (grey 500 text on grey 100, brand red on the pink tint, brand red links on the off-white background); text colours were darkened (`stone-600`, `brand-dark`), so the WCAG AA gate stays green. Remaining pages and dialogs are restyled step by step.

**D-43 - Self-service registration (2026-10-05).** The login page now has "Create account". *Security decisions:* the role is never part of the request; a new account is always a **translator** (the lowest role) and an admin promotes people; usernames are unique **case-insensitively** ("Admin" cannot be registered next to "admin"); passwords need 10+ characters and are stored with Argon2id; registration is **rate limited** (5 accounts per IP and hour); the whole feature can be switched off with `ALLOW_REGISTRATION=false` (the login page then hides the button; the API answers 403). The login page asks `GET /api/auth/options` whether to show the button. Creating an account does **not** sign the user in: the API returns the new user (201) without a token, the browser goes to the sign-in page with a short confirmation, and the user signs in there like everybody else. The login form no longer pre-fills a user or shows the demo passwords (they exist only with `SEED_DEMO_DATA`, development). The confirmation field is checked in the browser and never sent (found by a test). *Naming:* the call the browser makes on every page load to find out who is signed in is `GET /api/users/current-user` (operation `read_current_user`; it was `/api/auth/me`): the signed-in user is a named sub-resource of users that says what it returns (a bare `me` is a convention that needs explaining), and it keeps `/auth/*` for the sign-in steps (login, register, options). *Resilience:* the "who is signed in" request is retried three times with a growing pause when the server answers with an error or not at all (a restart, a short network gap), and the page shows "loading" meanwhile instead of jumping to the sign-in page; only a rejected token (401) ends the session at once. *Open question for the product owner:* accounts are active immediately; if the company wants a vetting step, new accounts could start inactive until an admin approves them.

**D-44 - One review step instead of two (2026-10-06, migration 0003).** The process had a state "in review" between the translator's preview and the reviewer's approval, reached by a "send for review" button, and a "reject" button to go back. That was a second review step on top of the real one: the reviewer's approval. It is removed: **new -> in review (the finished preview, waiting for the reviewer) -> approved**. The internal value stays `preview_ready`, its label is now "In Prüfung" / "In review" (the dashboard card with that name counts these projects, as the task description lists it). Removed: the `submit-review` and `reject` endpoints, the two buttons, the fourth workflow step and the colour of the old state. A reviewer who does not approve simply leaves the project as it is; comments on segments carry the feedback. Migration `0003` moves every project that was `in_review` to `preview_ready` and narrows the check constraint; the downgrade restores the constraint (nothing to move back). Tests cover the data move and that the database refuses the old value afterwards. *Trade-off:* a translator can no longer explicitly hand a finished preview over; the project list filter "In Prüfung" is the reviewer's queue. If a handover with a notification is wanted later (the task lists notifications as a future extension), it would be a new, deliberate feature, not an unreachable status.

**D-45 - Quality findings in the user's language, and an honest approval dialog (2026-10-06).** Two problems were found by using the app: the quality check's sentences ("Fachbegriff ... fehlt aber im Glossar") stayed German in the English interface because the backend wrote them, and the approval dialog said "3 warning(s)" for what were only hints (technical terms that are not in the glossary yet) without showing them. *Fix 1:* every finding now carries a `code` (`QualityCode`, ten values) and its `params` (the values of the sentence); the interface builds the sentence from `quality.findings.<code>` in the current language. The German `message` stays in the API for the Word/Excel/PDF report and for findings stored before the codes existed (shown as stored; `code` is optional). Contract tests check the codes and the values of every kind of finding. *Fix 2:* the dialog only mentions **errors and warnings**; hints (advice such as terms missing from the glossary) stay in the quality check panel. When there are problems it names their numbers, lists up to five of them, says how many more there are and links to the full quality check; without problems it asks the plain question. *Still German:* the exported report (a document, written in the language of the project's source text) and the other messages the API sends in error responses; the same code-plus-values approach would translate them.

**D-46 - Exported documents speak the language of the translation (2026-10-06).** An English translation was exported with German headings ("Übersetzung", "Kommentar"), a German quality report ("Prüfbericht", German findings) and German positions ("Absatz 1", "Seite 1"). The fixed words of Word, Excel and PDF exports now follow the **target language of the export** (`app/export/texts.py`, German and English, English as the fallback like the interface): column headings, the comment label, positions, the report heading and sheet, its column titles, the severity names and the findings themselves, which are written from their `code` and `params` (D-45). Findings stored before the codes existed, or with a missing value, fall back to their stored message instead of a broken sentence. The user's own content (segment text, comments) is of course not touched. Tests cover an English and a German export and the report lines in both languages.

**D-47 - No blocking dialog for saving (2026-10-06).** Every action on the project page (saving a comment or an edit, approving, regenerating) showed a full "Please wait" dialog while it ran; quick saves made it flash for a fraction of a second, and it blocked the page. It is replaced by a small notice in the corner (`SaveStatus`): "Saving ..." appears only when an action takes longer than 0.4 s, then "Saved" for 1.8 s, nothing after a failure (the error is shown where the action started). It is announced to screen readers (`role="status"`) and gives the missing confirmation that a comment, which saves when the field is left, was stored. Tests with fake timers cover the quick save, the slow one, the failure and the quiet start.

**D-48 - The layout uses the screen and never scrolls sideways (2026-10-06).** The project list had a horizontal scrollbar, while wide screens left a lot of unused space on both sides (content capped at `max-w-6xl`). Causes and fixes:
* The content is now up to 100 rem wide.
* Tailwind breakpoints refer to the window, but the sidebar takes 17 rem from `md` on, so the content is only about 420 px wide at `md`. Multi-column layouts therefore switch one step later (`lg`/`xl`).
* Tables hide less important columns on smaller screens (customer, creator, changed, languages; synonyms, description, version; name, active). The first column takes the remaining width and truncates, and the file name moves under the project name.
* Row actions became round icon buttons (`IconAction`); the label is their accessible name and tooltip.
* Cards are `min-w-0`, so one long file name can no longer widen a grid. `Card flush` replaces padding overrides for tables.
* Rarely used project filters fold away below `lg` ("More filters"). The date fields say "From"/"To" inside the field.
* "Original file" moved from the workflow toolbar to the file name in the project facts, where it belongs and where it no longer wraps onto its own row.

A script checked 10 pages at 6 widths (390 to 1920 px) in both languages for any element that scrolls sideways; none does.

**D-49 - Archived work still counts as approved (2026-10-06).** The dashboard's "Approved" tile counted only projects with status `approved` that were not archived. An export with "archive afterwards" sets the status to `archived`, so a project dropped out of the count the moment it was delivered, and the tile showed 0 right after an approval. The tile now counts every project whose status is in `FINISHED_STATUSES` (approved or archived), archived or not. "Open" and "In review" still count active projects only, because archived work is not waiting for anyone. The export test checks that the count stays the same when an export archives the project. The approvals chart counts approval events, not projects, so reopening and approving again counts twice. It now has square bar tops with the number above each bar, a start date and "Today" under the axis, and singular/plural texts ("1 approval").

**D-50 - The Excel import says which rows it skipped (2026-10-06).** After an import the page only showed counts ("3 skipped"). The reasons were sent, but only as German text, and were never shown. Each skipped row now carries a `code` (`ImportSkip`: `missing_term`, `duplicate`) and, for a duplicate, the `term`. The page lists the rows in the interface language ("Row 12: term or translation missing"). The German `reason` text stays in the response for API clients without their own wording. The sample `samples/glossar_beispiel.xlsx` (from `make_samples.py`) now holds terms of the German PDF sample and one row for each import rule: a "do not translate" product number without English, a draft, an unknown category and status that fall back to defaults, a row without a translation and a term that appears twice. An e2e test uploads this file and checks the listed reasons.

**D-51 - One full page per file type to try (2026-10-06).** The earlier samples were a few lines each, which shows little of how a real document behaves. `make_samples.py` now also writes one full A4 page in each format, each on a different topic, using the terms of the sample glossary, protected article numbers and words outside the glossary:
* `Pflegeanleitung_Kueche.pdf`: care instructions, with headings and paragraphs (18 text blocks).
* `Garantiebedingungen.docx`: warranty terms, with headings, a table and a bulleted list (34 paragraphs). It is A4 with DIN 5008 margins instead of python-docx's US Letter default, which had pushed it onto a second page.
* `Ersatzteilliste.xlsx`: a spare parts list in six groups. Text cells are translated (194), while article numbers, packing units and prices stay numbers. It is set to print on one portrait page.

Word and Excel themselves confirmed one printed page each; the PDF has one page, filled to the bottom margin.

**D-52 - The target is always the other language (2026-10-07).** With German and English only, choosing target languages could only go wrong: ticking both for a German file looked like it asked for a German translation, which never came ("not translated yet" in a DE tab). The target is now derived, never chosen: `target_languages(source)` returns the other language, or none while detection could not tell.
* Upload, a source change (`PATCH`) and every translation start set it from the source.
* The `target_langs` upload field and translate body field are gone; an older client that still sends them is ignored.
* With no known source, translating is refused at once with a clear message (400), instead of failing later in the background job.
* The form and the project page show the target as a fixed value next to the source language. The language tabs, the export's language choice and the "default target language" setting are removed.
* Migration 0004 gives every project the other language as its only target. Its SQL casts to `json` only on PostgreSQL, which, unlike SQLite, does not turn text into json by itself (see section 6).

The `target_langs` column and list stay as they are, so adding a third language later is a matter of this one function.

**D-53 - An Excel file is read as a table (2026-10-07).** The page view laid an Excel sheet out like a letter: every cell a paragraph, short cells guessed as headings, and the numbers (prices, packing units) missing, because only text cells are segments. A new endpoint, `GET /projects/{id}/cells`, returns every non-empty cell of the original sheet, with the decimals of its number format and whether it is bold. `SheetView` rebuilds the rows and columns from that:
* Like the page view, the original is on the left and the translation on the right. Both halves are one table, so every row stays level with its translation, and terms stay clickable on both sides.
* Numbers are formatted in the interface language (12,90 / 12.90) and right-aligned, with their column heads.
* A row of bold cells is the column head. A row with a single bold cell, such as a title or a group, spans its half. Empty rows stay as spacing.
* Numbers and article numbers ("FB-6001") keep one line. Text is hyphenated in its language (`lang` on each half) and broken mid-word only as a last resort.

Twelve columns side by side need room. Measured on the six-column sample, they read well from 1536 px. At 1440 px the table still fit, but prices broke into "12 / 90" and compounds mid-word. Below 1536 px each cell therefore shows the translation with the original below it in small type: still both texts, without a table too wide to read. On a phone that table scrolls inside its card. The switch calls it "Table view" for Excel files. Bold formatting is used instead of guessing headings from text length, which is what made the page view unreadable. Formulas show their last calculated value, and none if the file was never opened in Excel.

The first version only showed the translation (with the original in small type), which missed the point of the view: comparing the original and the translation side by side. A missing space in a class list (`pr-5text-left`) had also cancelled the alignment of the column heads and prices.

**D-54 - Every finding can be fixed from the quality check (2026-10-07).** The quality check listed problems but gave no way to solve them. Clicking a finding only scrolled to an anchor, which the table view does not even have, so a user had to find the segment and the right dialog alone. Each finding now carries its fix:
* **A finding on a segment:** "Edit segment #n" switches to the segment list, scrolls to the row and marks it for 3 s.
* **A contradiction** ("Hängeschränke": "wall units" / "wall cabinets"): one button per translation, "Use 'wall cabinets' everywhere". It replaces the other variants in every segment through the existing `replace-term` endpoint and, when ticked (the default), adds the term to the glossary, so the next translation is consistent. The check sends the variants as `params.options`.
* **A frequent term missing from the glossary:** "Add to glossary: Kunststoff -> plastic", with the translation the text uses (`params.target`), without the capital letter of a sentence start, keeping abbreviations such as "LED". A term that is already in the glossary is left as it is (409), not overwritten from here.
* Without edit rights, or after approval, the panel only offers "Show segment #n".

Two fixes in the check itself:
* **Singular and plural are the same translation.** German "Schrankaufhänger" is both, while English needs "cabinet hanger" and "cabinet hangers", which the check had reported as a contradiction. Translations are now compared without plural and case endings (English `-s`/`-es`, German `-e`/`-en`/`-n`/`-er`/`-s`/`-es`).
* **Terms are named as written** ("Hängeschränke", not "hängeschränke").

`replace-term` keeps a capital letter at a sentence start: "Wall units hang" becomes "Wall cabinets hang".

**D-55 - An Excel file exported to Word or PDF stays a table (2026-10-07).** The Word and PDF exporters wrote every segment as a paragraph, which suits a Word or PDF original but turned a spreadsheet into a list of loose cells ("Item no.", "Description", "SC-110", ...). For an Excel project both now rebuild the sheet as a table, from the same cell data as the table view (`read_cells`):
* **Translation only:** the translated sheet. **Original + translation:** each text cell holds the translation with the original below it in small grey type, so the export fits a portrait page instead of needing twelve columns.
* Numbers keep the decimals of their cell format, written the way the reader of the translation writes them ("12,90" in German, "12.90" in English), and are right-aligned with their column head.
* A row with a single cell in the first column (a title or a group) spans the table. Bold cells stay bold. Empty rows are left out, since they would print as empty boxes. Comments, when chosen, follow in small italic type in their cell.
* **Column widths:** each column is at least as wide as its longest word, so a price or an article number never breaks ("12. / 90" in the first try). The rest of the line is shared by how much text a column holds. Word gets the widths per cell, which is what it follows.
* Word now uses A4 with 2 cm margins instead of python-docx's US Letter. Both formats switch to a landscape page for sheets with more than six columns.

The Excel export of an Excel project already writes into a copy of the original sheet and is unchanged. Checked with the user's real project (read-only, files generated outside the app) and rendered with Word itself. Tests cover the table shape, the merged title, the decimals, the alignment, the original in "both" mode, a PDF row, and German and English number notation.

**D-56 - Hints can be settled too: the glossary counts, and judgment calls can be accepted (2026-10-07).** Two gaps remained after D-54:
* **The check never looked at the glossary again.** It judged terms by the category stored at translation time. A term added to the glossary afterwards, even through the panel's own "Add to glossary" button, stayed "missing from the glossary" until the next translation. The check now receives the database and asks the current glossary (`build_index`, the same matching as the translation):
  * A listed term is no longer missing.
  * An ambiguous term whose translation the glossary confirms is no longer ambiguous.
  * A term whose translation the glossary contradicts becomes a glossary error, exactly as if it had been in the glossary from the start.
* **Some hints have no "fix".** A translation that is longer than usual, a different number of line breaks or an ambiguous term the reviewer judges correct are judgment calls, not errors. They can now be **accepted**:
  * Each finding has a stable `key` (language, code, segment, term). `PUT /projects/{id}/quality/accepted` stores the project's accepted keys (`projects.accepted_findings`, migration 0005).
  * The check marks those findings `accepted`, and the panel counts them instead of listing them ("3 accepted - reopen").
  * The approval dialog no longer asks about them, and the export report lists only what is still open.
  * Errors cannot be accepted (400): a missing translation or a broken glossary term has to be fixed.
* **Ambiguous terms** also get "Confirm translation (glossary)", which settles this and every later translation of the term.

Checked on the user's project: after they added "Hängeschränke" and "Stellfuß" to the glossary, both hints disappeared. On an approved project the panel offers no changes, only "Show segment". Tests cover the glossary-aware check (missing, confirmed, contradicted), accepting and reopening through the API, that an error is refused, and the panel's buttons and what they send.

**D-57 - Archived is a flag, not a status (2026-10-07).** Archiving had two meanings. The archive button set the flag `archived`. An export with "archive afterwards" set the flag and replaced the status with `archived`. The archived list then showed "Approved" for one archived project and "Archived" for another. The status filter could not find projects archived by hand, and taking a project out of the archive could not tell where it had been.
* The status now only describes the workflow (`new`, `preview_ready`, `approved`), and archiving is only the flag, set the same way by the button and by the export. An archived project keeps its status and is back exactly there when it leaves the archive.
* The badge shows "Archived" for every archived project (`StatusBadge archived`), in the list, on the dashboard and on the project page. The workflow steps show the real step. The status filter no longer offers "Archived", which the "Active / Archived / All" switch covers.
* Migration 0006 turns status `archived` into `approved` with the flag set (the old status was only ever set on approved projects) and removes the value from the check constraint.
* `FINISHED_STATUSES` is just `approved`. The dashboard counts archived projects as approved by their status (D-49 without the special case).

Checked on the user's projects: both archived ones show "Archived", and the dashboard counts both as approved. Tests cover the migration, the export (approved and archived), and the badge in the archived list.

**D-58 - A generated API client and one service per feature (2026-10-07).** Only the types were generated (openapi-typescript). The calls were written by hand: about 45 `get<…>('/projects/…')` in the components, so URLs were repeated (quality and replace-term twice each, the auth options twice), the response type was stated by hand at every call, and query keys were loose strings. Now:
* **Generated client.** openapi-generator (`typescript-axios`, single request object) writes one factory per tag from the backend's schema, with typed functions and models: `ProjectsApiFactory(API_CONFIG).getProjectDetail({ pid })` returns `AxiosPromise<ProjectDetail>`. Every URL lives there once; a wrong parameter or field is a compile error.
  * It runs in Docker (`npm run openapi:generate-specs`). Its npm wrapper needs Java and brought 16 audit findings (3 critical) into the dev tools, so it was not added.
  * The output is committed, so building needs neither Docker nor Java. CI regenerates it and fails on any difference.
* **Backend side.**
  * Operation ids are the route function names (`get_project_detail` → `getProjectDetail` instead of `get_project_detail_api_projects__pid__get`); vague names were made specific (`approve` → `approve_project`).
  * API models derive from `Schema`, which marks fields with a default as required in *response* schemas (`json_schema_serialization_defaults_required`). They are always sent, and the client now types them as present.
  * A sheet cell is `text` or `number` instead of `value: str | float`, which the generator could only express as an empty interface.
* **Generator quirks, handled in the script, not by hand-editing generated code.**
  * 7.14 marked shared enums nullable once an optional query parameter used them; pinned to 7.26, which does not.
  * Two parameter-property constructors are rewritten for `erasableSyntaxOnly`, and unused helper imports are removed for `noUnusedLocals`. The script stops if the generated code changes shape.
* **`shared/api`.**
  * `config.ts`: `API_CONFIG`, axios interceptors (bearer token; a 401 ends the session except on login; error answers become `ApiError` with the server's message, also for downloads whose error arrives as a file).
  * `base.ts`: `useApiRequest` (`{ data, loading, error, refetch }`, with `key`, `postProcess`, `preventRequest`) and `useMutation` (refreshes the listed keys).
  * `session.ts`: token and role check.
  * TanStack Query stays underneath, so caching, polling and refresh-after-save are unchanged.
* **Services.** `AuthService`, `UserService`, `GlossaryService`, `ProjectService`, `QualityService`, `ExportService`, and `SettingsService` in `shared/api/services`, because settings are read app-wide and `shared/` may not import features. Components call `ProjectService.useFetchProject(id)`, never a URL.
  * The term dialog (glossary) receives "replace everywhere" from the project page, so the glossary feature does not depend on the projects feature.
* **Bundles.** The generated client (37.6 kB, 5.3 kB gzipped) and the libraries are their own chunks, cached across app releases; no chunk passes Vite's 500 kB warning.

Tests (D-58): the API configuration is tested through generated factories (token, errors, 401, download errors, saving a file) and `useApiRequest` directly. All 162 unit tests, 332 backend tests and 15 end-to-end tests pass unchanged in behaviour.

**D-59 - Users can be deleted; their name stays and is retired (2026-10-07).** Until now a user could only be deactivated. A delete was easy to add safely: projects, translations, approvals, exports and glossary changes store who made them as **text**, not as a reference, so nothing breaks and the history keeps the name. Of three options (deactivate only, delete and keep the name, delete and anonymise), the user chose to keep the name. Anonymising would be the answer to a GDPR erasure request and can be added later.
* `DELETE /api/users/{uid}` (admins). An admin cannot delete themselves, and since the caller stays an admin, the application never ends up without one. The deleted user's token stops working at once (the user is looked up on every request).
* **The name is retired** (`retired_usernames`, migration 0007, stored in lower case). Self-registration is on, so without this someone could sign up as "max" and pass for the author of the former max's approvals. Creating or registering a retired name is refused with its own message.
* The editor filter of the project list still offers deleted users' names, because their work is still there.
* Creating a user in the admin page now also compares names case-insensitively, as registration already did ("Admin" next to "admin" was possible there).
* Frontend: a delete icon per row (not on your own row) with a confirmation that says the name stays in the history and is not given again.

Tests: deletion with the history intact, the dead token and the refused sign-in, the retired name for both creation paths (also in other letter case), the case-insensitive check, and the 400/404/403 cases. In the frontend: confirm and delete, no button on your own row, and no "active" choice for a new user.

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
| **Migration 0004 stopped the Docker app from starting** although every test passed | Tests run on SQLite, which stores text in a JSON column; PostgreSQL refuses it (`column is of type json but expression is of type text`) | `CAST(... AS json)` on PostgreSQL; nothing was half-applied, because PostgreSQL runs migrations in a transaction. Lesson: try a data migration on PostgreSQL, not only SQLite |

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
* Frontend: unit-test line coverage is about 58 % (the large pages are covered mostly by the end-to-end suite); the history screen does not show released versions yet although `GET /api/releases/{id}` exists; no screen-reader test; API responses are not validated at runtime (types are compile-time only).
* Dev-tool advisory without a fix (`braces` via Knip) is reported but not blocking (D-17); Starlette's deprecation of `httpx` in its test client is handled by `httpx2`.

**Not planned for this task:** InDesign, OCR, translation memory (Phase 2 in the spec).

## 8. Changelog

* **2026-09-30** – Initial implementation: backend, frontend, glossary, quality check, export, Docker, CI, tests.
* **2026-10-01** – Real Gemini integration verified; model alias + fallback (D-03); prompt tightened; PDF and EN → DE verified.
* **2026-10-01** – This engineering log created; frontend research completed (sources below).
* **2026-10-03** - First push to GitHub (public repository; secrets scanned before committing, task PDFs and `.env` excluded). CI caught a `.gitignore` bug (missing `frontend/src/lib`), fixed and verified from a fresh clone; audit gate split into blocking (production) and informational (dev tooling).
* **2026-10-01** – Frontend professionalised: 50 unit/component tests, 6 Playwright tests incl. axe accessibility scan on 11 screens, `jsx-a11y`, TanStack Query lint, Knip, error boundary, Husky/lint-staged/commitlint, EditorConfig, Dependabot, stricter CI. Fixed the accessibility defects the scan found.
* **2026-10-03** - Backend professionalised (D-21 to D-29): research, broad Ruff rules, security hardening, migrations, restart recovery, 287 tests at 99 % coverage (surfaced 8 real defects), hash-locked and audited dependencies (upgraded FastAPI/Starlette, PyJWT, python-multipart), hardened container, extended CI and pre-push hook, console guard and security-header tests in the end-to-end suite.
* **2026-10-03** - Frontend converted to arrow functions throughout and the style enforced by ESLint (D-30).
* **2026-10-03** - Frontend: reusable form and layout components and two hooks replace repeated markup (D-31).
* **2026-10-03** - Frontend regrouped by feature with enforced module boundaries (D-32).
* **2026-10-03** - Frontend: constants moved into `constants.ts` files per module (D-33).
* **2026-10-03** - Frontend: interface in German and English with i18next, typed keys, language switch (D-34).
* **2026-10-03** - Frontend: `ProjectView` split into eight components (D-35).
* **2026-10-03** - Frontend: full test run (109 unit + 10 end-to-end tests green), language end-to-end test, unused-translation-key test, lazy-loaded pages, coverage guard raised (D-36).
* **2026-10-03** - Frontend: component state reviewed and four places simplified (D-37).
* **2026-10-04** - Backend: fixed value sets as `StrEnum`s in one module, stored through a `Choice` column type without a schema change (D-38).
* **2026-10-04** - Backend regrouped by feature, same API and database schema (D-39).
* **2026-10-04** - Database: constraints in the schema, migration 0002, verified on PostgreSQL (D-40).
* **2026-10-05** - Backend: N+1 queries removed (403 -> 4 statements for 400 segments), test added (D-41).
* **2026-10-05** - Frontend design system started: brand tokens, Raleway, new navigation, dashboard, project screen, login (D-42).
* **2026-10-05** - Self-service registration with a translator role, rate limit and a switch (D-43).
* **2026-10-06** - One review step: the separate "in review" state and its buttons are gone, migration 0003 (D-44).
* **2026-10-06** - Quality findings with codes (translated in the interface), approval dialog lists the findings, own confirmation dialogs (D-45).
* **2026-10-06** - Exports: headings, positions and the quality report in the language of the translation (D-46).
* **2026-10-06** - Saving shows a small notice instead of a flashing dialog (D-47).
* **2026-10-06** - Wider content, responsive tables, icon row actions, no sideways scrolling (D-48).
* **2026-10-06** - Dashboard counts archived projects as approved; clearer approvals chart (D-49).
* **2026-10-06** - Excel import lists skipped rows with their reason; richer glossary sample (D-50).
* **2026-10-06** - Full-page samples in PDF, Word and Excel (D-51).
* **2026-10-07** - Target language is always the other one; migration 0004 (D-52).
* **2026-10-07** - Excel files get a table view with every cell of the sheet (D-53).
* **2026-10-07** - Quality findings can be fixed directly; singular/plural no longer a contradiction (D-54).
* **2026-10-07** - Excel projects export to Word and PDF as tables (D-55).
* **2026-10-07** - Quality check reads the current glossary; hints can be accepted; migration 0005 (D-56).
* **2026-10-07** - Archived is a flag only; one badge for all archived projects; migration 0006 (D-57).
* **2026-10-07** - Generated API client (openapi-generator, axios) and one service per feature (D-58).
* **2026-10-07** - "Active" is only offered when editing a user: a new account is always active; deactivating removes access while the history keeps the name (there is no delete).
* **2026-10-07** - Users can be deleted; the name stays in the history and is retired; migration 0007 (D-59).
* **2026-10-07** - The AI model is chosen from a list, not typed: the settings send `model_choices` (the configured Gemini model and its fallbacks), saving accepts only those (400 otherwise, naming the choices), and the page shows a dropdown. A typo can no longer break every translation.
* **2026-10-07** - README rewritten as a short guide: tools, Docker steps, development commands, AI and architecture in brief; requirement table and links to this log removed.

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
