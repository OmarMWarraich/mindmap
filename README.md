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

The repository is currently bootstrapped with Next.js, React, and TypeScript.

Implemented now:

- Next.js App Router project scaffold
- React 19 + TypeScript setup
- ESLint configuration
- Monaco dependency setup and smoke-test mount
- Core runtime dependencies for layout, schema validation, export, and persistence
- Initial project planning in [TODO.md](TODO.md)

Planned next:

- Study editor with Monaco
- Deterministic DSL parser and validation
- Inline learning-focused completions
- Mindmap generation, layout, and SVG rendering
- PNG export and local draft persistence

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

- Any non-empty line that is not `@root` or `@branch` is a leaf node.
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
- Monaco Editor via `@monaco-editor/react`
- ELK via `elkjs`
- Runtime schema validation via `zod`
- PNG export via `html-to-image`
- IndexedDB persistence via `idb`

These dependencies are installed, but most of their feature-specific integration work is still ahead.

## Getting Started

Install dependencies if needed:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Environment Variables

Next.js loads `.env*` files automatically for server-side code. Model provider settings are now defined and validated through [lib/config/env.ts](lib/config/env.ts).

Use [.env.example](.env.example) as the template for local configuration.

Required variables:

- `MODEL_PROVIDER` — one of `openai`, `azure-openai`, or `openrouter`
- `MODEL_API_KEY` — secret key for the chosen provider
- `MODEL_BASE_URL` — optional override for provider-compatible endpoints
- `MODEL_COMPLETION_MODEL` — model used for low-latency inline completions
- `MODEL_GENERATION_MODEL` — model used for on-demand mindmap generation

## Available Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates the production build.
- `npm run start` runs the production server.
- `npm run lint` runs ESLint.
- `npm run test` runs the Node.js test runner and will execute discovered test files as they are added.
- `npm run typecheck` runs TypeScript type checking without emitting build output.

## Project Structure

- [app](app) contains the Next.js App Router entrypoints.
- [public](public) contains static assets.
- [TODO.md](TODO.md) tracks the phased implementation plan.

## Development Direction

This app is intentionally not a generic note editor. The completion system is meant to behave like a study assistant:

- stay inside the current topic and branch
- prefer educationally useful additions over generic completions
- suggest the next relevant idea a student should know
- avoid duplication and unsupported tangents

The parser will remain the source of truth for structure. AI should enrich the writing experience, not invent the hierarchy.

## Roadmap

The execution plan is tracked in [TODO.md](TODO.md). The current build order is:

1. Foundation and app shell
2. DSL and shared data contracts
3. Deterministic parsing and validation
4. Editor workflow
5. Deterministic mindmap generation
6. Layout and rendering
7. Inline completion service
8. AI-assisted mindmap generation
9. Export and persistence
10. Hardening and release readiness
