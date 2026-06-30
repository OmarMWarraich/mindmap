# Mindmap

Mindmap is a learning-first study app for turning course content into structured mindmaps while the user types. The main idea is that writing notes should also teach: the editor should suggest relevant next concepts, missing subtopics, clarifying facts, and useful follow-up ideas that stay tightly aligned with the current topic.

## Product Goal

The core workflow is:

1. The user types topic content from a course book into a structured outline.
2. The app offers inline suggestions that help them learn the next relevant thing, not just finish a phrase.
3. The outline is parsed into a deterministic structure.
4. The structure is turned into a visual mindmap that can later be refined and exported.

This project is being built MVP-first. Deterministic structure, readability, and relevance come before broader AI features.

## Current Status

The app is no longer just a scaffold. The current build includes a public marketing site, OAuth sign-in, an authenticated study workspace, deterministic DSL parsing, AI-assisted source-to-DSL generation, mindmap preview rendering, export, and draft persistence.

Implemented now:

- Public landing page at `/`
- Custom login page at `/login`
- Protected workspace at `/workspace`
- Google and GitHub OAuth via Auth.js
- Deterministic DSL parser, validation, and AST pipeline
- Monaco-based DSL editor and source-notes input workflow
- AI-assisted inline completion and source-notes-to-DSL generation
- Mindmap generation, layout, SVG preview, and PNG export
- Local and cloud-backed draft restoration
- Generation history and project persistence
- Source-level smoke tests plus Node.js unit coverage across the core slices

Planned next:

- Stronger real-browser end-to-end coverage
- More production hardening around auth, provider failures, and persistence edges
- Continued iteration on generation quality and study-workflow polish

## MVP DSL Rules

The editor input is a small outline DSL designed to stay easy to type and deterministic to parse.

### Core Shape

Each document has exactly one root line, followed by one or more top-level branches.

```text
@root: Photosynthesis
- @branch: Overview
  - Definition
  - Why it matters
- @branch: Light-dependent reactions
  - Location: thylakoid membrane
  - Inputs: light, H2O, ADP, NADP+
  - Outputs: O2, ATP, NADPH
```

### `@root`

- The first non-empty line must be `@root: <label>`.
- `@root` appears exactly once.
- The root line has no leading indentation and no list marker.
- The root label is required and becomes the center topic of the mindmap.

### `@branch`

- A top-level branch line must be written as `- @branch: <label>`.
- Every branch belongs directly under the root.
- Branch lines must start at indentation level 0.
- Branch labels are required.
- The parser should treat every `@branch` as a new major section with its own subtree and color assignment later in generation.

### Indentation

- Indentation uses spaces only.
- One nesting level equals two spaces.
- Indentation must increase or decrease by one level at a time.
- Tabs are invalid.
- Only leaf nodes may be nested beneath a branch or another leaf node.
- A line's parent is the nearest previous line whose indentation is exactly one level shallower.

### Leaf Nodes

- A leaf node is any non-empty non-`@branch` line written as `- <label>`.
- Leaf nodes must be written as `- <label>`.
- Leaf nodes require a label after the marker.
- A leaf node may appear directly under a branch or under another leaf node.
- Leaf nodes carry the study content shown in the preview, such as definitions, steps, examples, causes, effects, inputs, or outputs.

### MVP Validation Rules

- Ignore blank lines.
- Reject content before the root line.
- Reject multiple root lines.
- Reject a branch before the root.
- Reject leaf nodes before the first branch.
- Reject indentation that skips a level.
- Reject indented branch markers; `@branch` is only valid at the top level.
- Preserve label text as authored except for trimming surrounding whitespace needed for parsing.

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- ESLint 9
- Tailwind CSS 4
- Auth.js 5 beta with Google and GitHub OAuth
- Drizzle ORM with the Auth.js Drizzle adapter
- Neon serverless Postgres driver
- Monaco Editor via `@monaco-editor/react`
- ELK via `elkjs`
- Runtime schema validation via `zod`
- PNG export via `html-to-image`
- IndexedDB persistence via `idb`

The product mixes deterministic parsing and rendering with model-backed assistance, while keeping the DSL parser as the structural source of truth.

## What The App Does

- The public landing page explains the product and routes sign-in traffic to the custom login flow.
- Signed-in users work inside a multi-panel study workspace with notes, DSL editing, preview, chat, scaling, and generation history surfaces.
- Raw source notes can be expanded into parser-ready DSL in `standard` or `detailed` mode.
- The DSL is parsed into a deterministic AST, then rendered into a visual mindmap preview.
- Graph layout for both preview and PNG export runs off the main thread in a Web Worker ([workers/mindmap-layout.worker.ts](workers/mindmap-layout.worker.ts)), so large or upscaled maps stay responsive; it falls back to in-page layout where workers are unavailable (e.g. server-side rendering).
- Drafts are restored from cloud persistence when available and fall back to local IndexedDB state.
- The current preview can be exported as PNG.

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

Primary routes:

- `/` public landing page
- `/login` OAuth sign-in
- `/workspace` authenticated study workspace

## Environment Variables

Next.js loads `.env*` files automatically for server-side code. Model provider settings are defined and validated through [lib/config/env.ts](lib/config/env.ts).

Use [.env.example](.env.example) as the template for local configuration.

Model provider credentials (per-provider keys):

- `OPENAI_API_KEY` — secret key for OpenAI models (e.g. `gpt-4o-mini`, `gpt-4o`)
- `ANTHROPIC_API_KEY` — secret key for Anthropic Claude models (e.g. `claude-haiku-4-5`, `claude-sonnet-4-5`)
- `DEEPSEEK_API_KEY` — commented placeholder; uncomment once DeepSeek joins the model catalog

Set only the providers you plan to use. Provider keys are checked for presence (and placeholder values) at boot and when deriving the list of available providers; request-time failures will still surface when a provider model is actually used. At least one provider key must be configured, or the server refuses to start (validated at boot in [instrumentation.ts](instrumentation.ts)).

OAuth variables are also required for local sign-in flows when using Google and GitHub providers. Configure the standard Auth.js provider credentials in your local environment before testing authentication.

## Authentication

Sign-in is handled by Auth.js with the Google and GitHub OAuth providers and database-backed sessions (Drizzle adapter).

### Account-linking decision: no automatic cross-provider linking

Cross-provider email account linking is intentionally **disabled** (`allowDangerousEmailAccountLinking` is not set; it defaults to `false`).

- **Why.** With that option enabled, an unauthenticated OAuth sign-in is merged into any existing user that has the same email address. Auth.js performs this merge on an email match alone — it does not verify that the provider confirmed the user owns that email (the default GitHub provider, for instance, selects the primary email without checking its `verified` flag). If any enabled provider returns an unverified email, that auto-link becomes an account-takeover vector. Disabling it follows Auth.js's own recommended practice.
- **Behavior.** Each provider's sign-in works normally. If you sign in with one provider and later sign in with a *different* provider that presents an email already attached to an account, Auth.js raises `OAuthAccountNotLinked` and the [login page](app/login/page.tsx) explains it; sign in with the provider you used originally to reach that account.
- **Where it lives.** The decision and rationale are recorded in [auth.ts](auth.ts); a source test locks it so it cannot be silently re-enabled.

### Inline-completion rate limiting (optional, distributed)

Inline-completion requests are rate-limited per client and provider. By default the limiter — and the short-lived completion cache — is in-memory: correct for a single instance, but per-instance on serverless. To enforce a global budget across instances, set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (Upstash Redis REST); the limiter then uses Redis and fails open if it is unreachable. The completion cache deliberately stays in-memory — its keys are per-user and per-cursor, so the cross-instance hit rate is negligible and a shared cache would only add latency to the ghost-text path.

## Observability

### Structured logging

Server-side code logs through a small structured logger ([lib/observability/logger.ts](lib/observability/logger.ts)): one JSON line per event (stdout for info, stderr for warnings/errors), captured automatically by serverless log drains. The level is controlled by `LOG_LEVEL` (`debug` | `info` | `warn` | `error` | `silent`); with no value set it logs at `info` in production/development and stays silent elsewhere, so the test suite is quiet. API routes log 5xx failures — model/provider, parse, and persistence errors — with structured context (route, status, error name/message); validation 4xx responses are not logged, and stack traces are intentionally omitted.

### Inline-completion telemetry

Inline-completion lifecycle events (accepted / dismissed / ignored, with timing and request reason) are persisted per user to the `completion_event` table for acceptance-rate analysis. For privacy, the raw suggestion text is never stored — only its length — since suggestions can echo the user's notes. Recording is best-effort: a database failure is logged and never fails the request. Applying the table requires running the Drizzle migration (`drizzle-kit migrate` / `push`).

## Available Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates the production build.
- `npm run start` runs the production server.
- `npm run lint` runs ESLint.
- `npm run test` runs the Node.js test runner and will execute discovered test files as they are added.
- `npm run typecheck` runs TypeScript type checking without emitting build output.

## Project Structure

- [app](app) contains App Router routes, including landing, login, workspace, and API endpoints.
- [components](components) contains the workspace UI, preview surfaces, and marketing sections.
- [lib/dsl](lib/dsl) contains the deterministic parser, validation, and editor-context logic.
- [lib/generation](lib/generation) contains AI-assisted generation and overlay services.
- [lib/completion](lib/completion) contains inline completion prompting, normalization, and relevance logic.
- [lib/mindmap](lib/mindmap) contains schema, AST conversion, layout, and preview generation.
- [lib/persistence](lib/persistence) contains project, draft, and history persistence logic.
- [workers](workers) contains the mindmap layout worker.
- [drizzle](drizzle) contains database migrations and metadata.
- [TODO.md](TODO.md) tracks the phased implementation plan.

## Development Direction

This app is intentionally not a generic note editor. The completion system is meant to behave like a study assistant:

- stay inside the current topic and branch
- prefer educationally useful additions over generic completions
- suggest the next relevant idea a student should know
- avoid duplication and unsupported tangents

The parser will remain the source of truth for structure. AI should enrich the writing experience, not invent the hierarchy.

## Testing

- `npm run test` runs the Node.js test suite for parsing, generation, completion, layout, export, persistence, and app-risk smoke coverage.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript in no-emit mode.

## Roadmap

The execution plan remains tracked in [TODO.md](TODO.md), but the current emphasis is no longer foundational scaffolding. The remaining work is mostly hardening, deeper test coverage, and continued quality improvements to the study workflow and generation behavior.
