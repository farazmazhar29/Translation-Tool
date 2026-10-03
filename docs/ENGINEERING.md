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
| **FastAPI** | REST API | Typed request/response models, automatic **Swagger/OpenAPI** docs, async-ready, the standard for Python AI services | Flask (no typing/docs built in), Django (heavier than needed) |
| **Pydantic v2** | Validation, API contract (`schemas.py`) | One typed source of truth for input validation, output shape and the docs | Hand-written dicts |
| **SQLAlchemy 2** | ORM | Fully typed `Mapped[...]` models, works with SQLite (dev) and PostgreSQL (prod) | Raw SQL, SQLModel (less mature typing) |
| **PostgreSQL** (Docker) / **SQLite** (dev) | Persistence | Same code, zero-setup development, real DB in production | MongoDB (data is relational) |
| **python-docx, openpyxl, PyMuPDF** | Read/write Word, Excel, PDF | Edit files *in place* so formatting and formulas survive | Converting everything to text |
| **ReportLab** | PDF export | Pure Python, no system dependencies | WeasyPrint (needs native libs) |
| **httpx** | Gemini HTTP calls | Modern, typed, timeouts | requests |
| **PyJWT** + PBKDF2 (stdlib) | Login | Stateless auth; no extra dependency for hashing | passlib (version friction) |
| **pydantic-settings** | Config from `.env` | Typed settings, 12-factor | os.environ everywhere |
| **pytest** + FastAPI TestClient | Tests | Whole workflow tested through the real API | unittest |
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
| **Docker + Compose** | One image serves API and built UI → matches "central web server, browser only, no client install". |
| **GitHub Actions** | Runs the same gates as local development on every push. |
| **Husky + lint-staged** | Git hooks: format/lint only the *staged* files on commit (fast), frontend checks on push. Configs live per folder so each tool runs in its own directory. |
| **commitlint (Conventional Commits)** | Readable history (`feat:`, `fix:`, `docs:` ...) enforced automatically; enables changelogs later. |
| **EditorConfig + `.gitattributes`** | Same indentation/line endings in every editor and OS (LF everywhere; avoids CRLF noise from Windows). |
| **Dependabot** | Weekly grouped update PRs for npm, pip, Actions and Docker; also raises security updates. |
| **Google Gemini (free tier)** | Free LLM with structured JSON output; behind a provider interface (see D-02). |

## 3. Coding standards

**Backend**
* Strict Pyright (`typeCheckingMode: strict`) with **0 errors**; no `Any` leaking from untyped libraries (local stub for PyMuPDF).
* Ruff: pycodestyle, pyflakes, isort, pyupgrade, bugbear, simplify, ruff-specific rules; line length 120.
* Routes are thin; logic lives in `services/`. Every endpoint has a `response_model` and a one-line summary (shows in Swagger).
* Permissions are enforced server-side with dependency aliases (`Translator`, `Reviewer`, `Admin`).
* Errors the user can fix are returned as German messages with a proper status code (400/409/403), never as 500s.

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
| Backend lint/format | `ruff check . && ruff format --check .` | CI |
| Backend types | `pyright -p ..` (strict) | CI |
| Backend tests | `pytest` | CI |
| Frontend types | `npx tsc -b` | CI |
| Frontend lint | `npm run lint` (typed, strict) | CI |
| Frontend build | `npm run build` | CI |
| Formatting | `npm run format:check` (Prettier) | CI |
| Dead code | `npm run knip` | CI |
| Unit + component tests | `npm run coverage` (50 tests, coverage guard) | CI, pre-push |
| Dependency audit | `npm audit --audit-level=high` | CI |
| End-to-end + accessibility | `npm run e2e` (Playwright, real backend, axe on 11 screens/dialogs) | CI |
| Staged files | ESLint/Prettier (TS), Ruff (Python) | pre-commit |
| Commit message | commitlint, Conventional Commits | commit-msg |
| Frontend `check` | `tsc` + ESLint + unit tests | pre-push |

Backend gates (Ruff, strict Pyright, pytest) run in CI; only Ruff runs locally on commit because Python tooling needs the virtualenv.

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

**D-18 - Dead-code detection with Knip (2026-10-01).** It found an unused helper (`patch`) and two exports that nothing imported; all removed.
*Why:* unused code is maintenance cost and misleads readers; a graph-level tool finds what a per-file linter cannot.

**D-19 - Error boundary (2026-10-01).** A rendering crash shows a recovery message instead of a blank page; the class documents where to hook in a monitoring service.

**D-20 - Isolated end-to-end environment (2026-10-01).** Playwright starts its own backend on port 8765 with the mock translator and a throw-away database.
*Why:* tests must be deterministic, free (no Gemini quota) and must never touch a developer's or a deployed instance.

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
| Pre-commit ESLint could not find its config | lint-staged ran from the repo root | Per-folder lint-staged configs |
| Page declared `lang="en"`, title "frontend", Vite favicon | Template defaults never replaced | `lang="de"` (screen readers pronounce German correctly), real title and description, own favicon, unused template asset removed |

## 7. Status and roadmap

**Done:** all 17 sections of the specification except InDesign (see README coverage table).

**Done - frontend professionalisation (2026-10-01):** tests (Vitest, Testing Library, MSW), Playwright end-to-end with axe, `jsx-a11y`,
TanStack Query lint, Knip, `prettier --check` + `npm audit` in CI, Husky + lint-staged + commitlint, EditorConfig, Dependabot, error boundary.

**Known limits (honest list):** the GitHub Actions workflow has not run yet (the repository has not been pushed); unit-test line coverage
is ~43% because pages are covered by the end-to-end suite; pre-push hooks cover the frontend only; manual accessibility testing
(screen reader) has not been done; Zod runtime validation of API responses is not implemented (types are compile-time only).

**Next – backend professionalisation:** research, then apply (coverage, security headers, migrations, structured logging, …).

**Not planned for this task:** InDesign, OCR, translation memory (Phase 2 in the spec).

## 8. Changelog

* **2026-09-30** – Initial implementation: backend, frontend, glossary, quality check, export, Docker, CI, tests.
* **2026-10-01** – Real Gemini integration verified; model alias + fallback (D-03); prompt tightened; PDF and EN → DE verified.
* **2026-10-01** – This engineering log created; frontend research completed (sources below).
* **2026-10-01** – Frontend professionalised: 50 unit/component tests, 6 Playwright tests incl. axe accessibility scan on 11 screens, `jsx-a11y`, TanStack Query lint, Knip, error boundary, Husky/lint-staged/commitlint, EditorConfig, Dependabot, stricter CI. Fixed the accessibility defects the scan found.

## 9. Sources (research, 2026-10-01)

* typescript-eslint – [shared configs](https://typescript-eslint.io/users/configs/) (note: `strict-type-checked` is not semver-stable → pin the version)
* Playwright – [best practices](https://playwright.dev/docs/best-practices)
* TanStack Query – [ESLint plugin](https://tanstack.com/query/latest/docs/eslint/exhaustive-deps)
* [Knip](https://knip.dev/) – unused files, exports and dependencies
* Community roundups (lower authority, used only where several agree): [React best practices 2026](https://dev.to/nozibul_islam_113b1d5334f/react-best-practices-2026-2ng2),
  [Biome vs ESLint vs Oxlint](https://www.pkgpulse.com/guides/biome-vs-eslint-vs-oxlint-2026),
  [Testing React apps in 2026](https://nirajiitr.com/blog/react-testing-2026-vitest-rtl-msw),
  [axe-core + Playwright in CI](https://rishikc.com/articles/accessibility-testing-ci-integration/),
  [Husky + lint-staged](https://dev.to/_d7eb1c1703182e3ce1782/git-hooks-with-husky-and-lint-staged-the-complete-setup-guide-for-2025-53ji),
  [Dependabot vs Renovate](https://appsecsanta.com/sca-tools/dependabot-vs-renovate)
