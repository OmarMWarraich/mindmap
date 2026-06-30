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

Set only the providers you plan to use. Each key is validated lazily — the first time one of that provider's models is requested — so the server can hold credentials for several providers without forcing every key to be set. A provider whose key is absent is simply omitted from the models the UI may offer. At least one provider key must be configured, or the server refuses to start (validated at boot in [instrumentation.ts](instrumentation.ts)).

OAuth variables are also required for local sign-in flows when using Google and GitHub providers. Configure the standard Auth.js provider credentials in your local environment before testing authentication.

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
