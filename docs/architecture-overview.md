# Architecture Overview

> **Status:** Analysis only — no design or behavior changes are proposed here.
> **Snapshot:** Reverse-engineered from the `dev` branch on 2026-06-30.
> **Audience:** Engineers onboarding to the codebase who need a map of the system
> before touching it.

Mindmap is a learning-first study app. A user types course content as a small
outline **DSL**; the app parses it deterministically into an AST, renders a
radial **mindmap**, and offers two kinds of AI assistance — inline "next concept"
completions while typing, and source-notes → DSL generation. The deterministic
parser, not the model, is the source of truth for structure.

---

## 1. Architecture Overview

### 1.1 Shape of the system

This is a single **Next.js 16 (App Router) full-stack monolith** — no separate
backend service, no message broker, no microservices. Server and client code
live in one deployable. Persistence is a single Postgres database (Neon
serverless driver) plus browser-local IndexedDB for offline drafts.

> ⚠️ This is Next.js **16**, which has breaking changes vs. older mental models.
> The most visible one: middleware is now [`proxy.ts`](../proxy.ts) (formerly
> `middleware.ts`) and exports `proxy = auth(...)`. Project guidance
> ([AGENTS.md](../AGENTS.md)) explicitly warns that conventions differ from older
> Next.js.

### 1.2 Layers

The code separates cleanly into layers, roughly: **routing/UI → API handlers →
domain services → deterministic core + model abstraction → persistence**.

| Layer | Location | Responsibility |
|---|---|---|
| **Edge guard** | [`proxy.ts`](../proxy.ts) | Redirects unauthenticated traffic to `/login` (except `/` and `/login`). |
| **Pages / UI** | [`app/`](../app), [`components/`](../components) | Marketing landing, login, and the authenticated workspace (React 19 client + server components). |
| **API handlers** | [`app/api/`](../app/api) | Thin HTTP boundary: auth-guard, validate, delegate to a service, shape the response. |
| **Domain services** | [`lib/generation/`](../lib/generation), [`lib/completion/`](../lib/completion) | AI-assisted generation and inline completion orchestration. |
| **Deterministic core** | [`lib/dsl/`](../lib/dsl), [`lib/mindmap/`](../lib/mindmap) | DSL grammar → AST → mindmap JSON → ELK layout → SVG/PNG. No model calls. |
| **Model abstraction** | [`lib/model/`](../lib/model) | Provider-agnostic LLM catalog, authorization, dispatch, and wire-format adapters. |
| **Persistence** | [`lib/persistence/`](../lib/persistence), [`lib/db/`](../lib/db) | IndexedDB drafts + cloud (Drizzle/Neon) project/draft/history. |
| **Config / bootstrap** | [`lib/config/`](../lib/config), [`instrumentation.ts`](../instrumentation.ts), [`auth.ts`](../auth.ts) | Env validation, server bootstrap, Auth.js wiring. |

### 1.3 Design principles in evidence

- **Deterministic-first.** The DSL parser and AST→mindmap conversion are pure and
  model-free. AI output is layered on as a non-destructive *overlay* (label
  rewrites, grouping hints, missing subtopics) that cannot alter the structural
  hierarchy. See [`lib/generation/merge.ts`](../lib/generation/merge.ts).
- **Schema-as-contract.** Zod validates at every boundary: env, HTTP request
  bodies, model outputs, the generated-mindmap shape, the model catalog, and
  persisted drafts. Malformed model output is rejected, not trusted.
- **Provider abstraction.** Models are described in a static catalog and reached
  through a two-method adapter interface, so OpenAI-compatible and Anthropic
  Messages providers sit behind one dispatch path.

---

## 2. Data Flow (entry points → persistence)

### 2.1 Authentication / session

```
Browser → proxy.ts (edge) ──unauth──→ redirect /login
                          └─auth────→ pass through
/login → signIn('github'|'google', { redirectTo: '/workspace' })
       → Auth.js handler /api/auth/[...nextauth]
       → DrizzleAdapter persists user/account/session rows (Postgres)
       → session cookie; session callback injects user.id
/workspace (server component) → auth() guard, redirect('/login') if absent
```

Auth.js v5 (beta) with **database sessions** via the Drizzle adapter. Every API
route is wrapped in `auth(...)` and re-checks `req.auth.user.id`.

### 2.2 Inline completion (type → suggestion)

```
Monaco editor (DslEditorPanel)
  → monaco-inline-provider.provideInlineCompletions (AbortController ↔ cancel token)
  → completion/client → POST /api/completion        [runtime: nodejs, auth-guarded]
      → rate limit + cache check (runtime-controls.ts, in-memory, 15s TTL)
      → completion/service.generateInlineCompletion
          → context.ts (extract recent-token window + structural context)
          → prompt.ts → model/dispatch (≤72 token cap, no structured output)
          → normalize.ts → relevance.ts → sibling-check.ts  (reject or return)
  ← completion text (or empty)
  → Monaco renders ghost text
  → on accept/dismiss/ignore: POST /api/completion/events
      → instrumentation.recordInlineCompletionEvent (in-memory array)
```

### 2.3 Source notes → DSL generation

```
SourceNotesPanel (standard | detailed)
  → generation/client → POST /api/generation/dsl     [auth-guarded]
      → authorize model id (catalog → allow-list → provider configured)
      → generation/source-service.generateMindmapDslFromSource
          → compute density/expansion targets from meaningful line count
          → source-prompt.ts → model/dispatch (structured JSON output)
          → normalize DSL → parse with lib/dsl → validate density / word limit /
            branch development → RETRY with feedback if unmet (bounded attempts)
  ← { dsl, metrics, validation, quality }
  → DSL written into Monaco editor
```

### 2.4 DSL → mindmap render (the deterministic core)

```
outline (DSL text)
  → lib/dsl/parse.parseMindmapDsl → AST (+ warnings/errors; lenient recovery)
  → lib/mindmap/from-ast.generateMindmapFromAst → GeneratedMindmap (Zod-validated)
        · branch colors + level tints (palette.ts)
        · auto-group branches with >6 children into "More:" chunks
        · per-node layout hints (size/padding/sibling gap)
  → lib/mindmap/to-elk.translateMindmapToElkGraph
  → lib/mindmap/layout.layoutMindmapWithElk  (ELK 'radial' algorithm)
  → MindmapSvgPreview renders SVG (pan/zoom)
```

Note: layout runs **synchronously on the main thread** in
[`StudyWorkspace`](../components/StudyWorkspace.tsx); the dedicated
[`workers/mindmap-layout.worker.ts`](../workers/mindmap-layout.worker.ts) exists
but is not currently wired in (the component's own diagnostics say it runs
"without the dedicated worker path").

### 2.5 Overlay enrichment (optional AI pass over a built mindmap)

```
AST + raw DSL + existing mindmap
  → POST /api/generation                              [auth-guarded]
  → generation/service.generateMindmapOverlay
      → build deterministic mindmap (no model) → model/dispatch for overlay JSON
      → merge.mergeDeterministicMindmapWithOverlay (label rewrites, grouping,
        missing subtopics — never restructures the hierarchy)
  ← final mindmap JSON
```

### 2.6 Export

```
ExpertScalingPanel sliders → layout.createExportMindmapVariant (scaled clone)
  → layoutMindmapWithElk → MindmapSvgPreview → html-to-image → PNG download
```

### 2.7 Persistence (drafts & history)

```
Local:  StudyWorkspace → persistence/workspace.saveWorkspaceDraft → IndexedDB
                                                        (idb, Zod-validated)
Cloud:  getOrCreateActiveProject → GET/POST /api/projects
        saveCloudDraft           → PUT  /api/projects/[id]/draft
        recordGenerationHistory  → POST /api/projects/[id]/history
Load:   cloud-first (loadCloudDraft) with fallback to local IndexedDB draft
```

All cloud routes run on the **Node.js runtime**, are auth-guarded, and **scope
every query by the session `userId`** (e.g. the draft route matches
`and(projects.id, projects.userId)` and returns 404 on mismatch — tenant
isolation is correctly enforced).

---

## 3. Extracted Inventory

### 3.1 Entry points

**HTTP APIs** (all `runtime = 'nodejs'`, all wrapped in `auth(...)`):

| Route | Methods | Purpose |
|---|---|---|
| [`/api/auth/[...nextauth]`](../app/api/auth/[...nextauth]/route.ts) | GET, POST | Auth.js OAuth handlers (GitHub, Google). |
| [`/api/models`](../app/api/models/route.ts) | GET | Role-filtered, client-safe model catalog for the UI. |
| [`/api/completion`](../app/api/completion/route.ts) | POST | Inline completion (rate-limited + cached). |
| [`/api/completion/events`](../app/api/completion/events/route.ts) | POST | Completion acceptance/dismissal telemetry. |
| [`/api/generation/dsl`](../app/api/generation/dsl/route.ts) | POST | Source notes → DSL (with retry loop). |
| [`/api/generation`](../app/api/generation/route.ts) | POST | Mindmap enrichment overlay. |
| [`/api/projects`](../app/api/projects/route.ts) | GET, POST | List / create user projects. |
| [`/api/projects/[id]/draft`](../app/api/projects/[id]/draft/route.ts) | GET, PUT | Load / upsert a project draft. |
| [`/api/projects/[id]/history`](../app/api/projects/[id]/history/route.ts) | GET, POST | List / append generation history. |

**Page entry points:** `/` (marketing), `/login` (custom OAuth page),
`/workspace` (protected server component).

**Edge entry point:** [`proxy.ts`](../proxy.ts) middleware (matcher excludes
`api`, `_next/static`, `_next/image`, `favicon.ico`).

**Server bootstrap:** [`instrumentation.ts`](../instrumentation.ts) `register()`
eagerly validates the **legacy** model-provider env on Node startup.

**Jobs / CLIs:** none. Operational entry points are npm scripts only — `dev`,
`build`, `start`, `lint`, `test` (`node --test`), `typecheck` — plus
`drizzle-kit` for migrations. **No queues, cron, or background workers.** (The one
worker file is a *browser* Web Worker, currently unused.)

### 3.2 Core domains (models & services)

- **DSL & AST** ([`lib/dsl/`](../lib/dsl)) — grammar constants (`mvp.ts`), AST
  types (`ast.ts`), the lenient recovering parser (`parse.ts`), validation
  result types (`validation.ts`).
- **Mindmap** ([`lib/mindmap/`](../lib/mindmap)) — `GeneratedMindmap` Zod schema,
  `from-ast` conversion, `palette` (6 branch colors + tint rules), `to-elk`,
  `layout` (ELK radial + export scaling), `svg-preview`, `worker-diagnostics`.
- **Generation** ([`lib/generation/`](../lib/generation)) — `source-service`
  (notes→DSL w/ density retries), `service` + `merge` (overlay), `prompt` /
  `source-prompt`, `schema` / `source-schema`, `client`.
- **Completion** ([`lib/completion/`](../lib/completion)) — `service`, `context`,
  `prompt`, `normalize`, `relevance`, `sibling-check`, `runtime-controls`
  (cache + rate limit), `monaco-inline-provider`, `client`, `instrumentation`.
- **Model abstraction** ([`lib/model/`](../lib/model)) — `catalog` (static source
  of truth) & `public-catalog`, `availability`, `authorization`, `resolve`,
  `dispatch`, `adapter` + `openai-compatible-adapter` + `anthropic-messages-adapter`,
  `json-parse`, `group-models`, `model-choice-storage`.
- **Persistence** ([`lib/persistence/workspace.ts`](../lib/persistence/workspace.ts),
  [`lib/db/`](../lib/db)) — IndexedDB drafts + cloud client; Drizzle schema:
  `user` / `account` / `session` / `verificationToken` (Auth.js) and `project` /
  `project_draft` / `generation_history` (app).

### 3.3 Cross-cutting concerns

- **Auth** — Auth.js v5 (beta), GitHub + Google OAuth, DB sessions via Drizzle
  adapter ([`auth.ts`](../auth.ts)). Edge guard in `proxy.ts`; every API route
  re-checks `req.auth.user.id`. Note: `allowDangerousEmailAccountLinking: true`
  is set on both providers.
- **Config** — *Two coexisting systems.* (1) **Legacy** single-provider env
  (`MODEL_PROVIDER` / `MODEL_API_KEY` / `MODEL_BASE_URL` / `MODEL_COMPLETION_MODEL`
  / `MODEL_GENERATION_MODEL`), eagerly validated at boot, still consumed by inline
  completion. (2) **Per-provider keys** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`),
  validated lazily on first use, used by the new model layer. Optional ops gate
  via model allow-list. `DATABASE_URL` for Neon. All env access flows through
  [`lib/config/env.ts`](../lib/config/env.ts).
- **Caching** — In-memory completion cache (15s TTL) + sliding-window rate limiter
  per `(provider, client)` ([`runtime-controls.ts`](../lib/completion/runtime-controls.ts)).
  Client model choice in `localStorage`; drafts in IndexedDB.
- **Logging / observability** — Effectively absent: two `console.error` calls
  total; completion telemetry is pushed to an in-process array that is never
  persisted or exported. No structured logging, metrics, or tracing.
- **Validation** — Zod, ubiquitous (env, requests, model output, catalog,
  persisted drafts, generated mindmap).
- **Cancellation** — `AbortController` bridged to Monaco cancellation tokens for
  inline completion requests.

### 3.4 Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 (imports use explicit `.ts` extensions) |
| Styling | Tailwind CSS 4 |
| Auth | Auth.js (next-auth) v5 beta + `@auth/drizzle-adapter` |
| ORM / DB | Drizzle ORM + Neon serverless Postgres (`@neondatabase/serverless`) |
| Editor | Monaco (`@monaco-editor/react`) |
| Graph layout | ELK (`elkjs`), radial algorithm |
| Validation | Zod 4 |
| Local persistence | IndexedDB (`idb`) |
| Export | `html-to-image` (PNG) |
| LLM providers | OpenAI-compatible + Anthropic Messages (via catalog/adapters) |
| Tests | Node.js built-in test runner (`node --test`, module mocks) |
| Queues / cache server | **None** (no Redis/queue despite being common in the stack) |

---

## 4. Potential Problem Areas

> Observations only — no fixes proposed or applied. Each is a candidate for
> follow-up investigation.

- **Test suite is red (3 failing tests).** The generation route tests
  ([`app/api/generation/dsl/route.test.ts`](../app/api/generation/dsl/route.test.ts) ×2,
  [`app/api/generation/route.test.ts`](../app/api/generation/route.test.ts) ×1) still
  configure the *legacy* `MODEL_*` env, but the generation endpoints now require
  per-provider keys (`OPENAI_API_KEY`). The tests went stale during the
  multi-provider migration; completion tests still pass because completion hasn't
  migrated yet.
- **`npm run typecheck` is broken by tooling, not code.** `node_modules/.bin/tsc`
  is a copied file rather than a symlink, so it can't resolve `../lib/tsc.js`.
  Running the compiler directly (`node node_modules/typescript/bin/tsc --noEmit`)
  passes clean — the source typechecks; only the script shim is broken (an install
  artifact, fixed by reinstall/rebuild).
- **Split-brain configuration.** Two model-config systems run side by side. The
  server *eagerly* validates legacy `MODEL_*` vars at boot
  ([`instrumentation.ts`](../instrumentation.ts)), so it can fail to start on
  missing legacy config even though generation no longer uses those vars; inline
  completion still depends on them. This is transitional (the README acknowledges
  it) but is a live source of confusion and boot-time fragility.
- **In-memory state assumes a single long-lived process.** The completion cache,
  rate limiter, and the inline-completion event log are all module-level in-memory
  structures. On a serverless/multi-instance deployment (e.g. Vercel) these are
  per-instance and ephemeral: rate limits won't hold globally, cache hit-rate
  collapses, and telemetry events are silently lost on cold start (they are never
  persisted anywhere).
- **Observability gap.** Near-zero logging and no metrics/tracing mean
  model/provider failures surface as generic errors with little diagnostic trail.
  This is in tension with the stated goal of "production hardening around auth,
  provider failures, and persistence."
- **Layout on the main thread.** ELK runs synchronously in the render component;
  the purpose-built Web Worker is unused. Large mindmaps risk blocking the UI
  thread during layout and export.
- **`allowDangerousEmailAccountLinking: true`** on both OAuth providers. This
  links accounts by email across providers; whether that is safe depends on each
  provider verifying email ownership. Worth a deliberate, documented decision
  rather than a default.
- **Draft PUT trusts client-supplied `mindmap` / `previewTransform` shape.** The
  cloud draft route stores these `jsonb` fields without server-side schema
  validation (validation happens client-side). It is correctly tenant-scoped, so
  this is a data-integrity/robustness note, not a security one.

---

*This document describes the system as observed; it does not prescribe changes.
Keep it updated as the architecture evolves — especially once the completion
endpoint migrates off the legacy model env and the layout worker is wired in.*
