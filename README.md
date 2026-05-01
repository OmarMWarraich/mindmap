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
- Initial project planning in [TODO.md](/Users/owa/code/mindmap/TODO.md)

Planned next:

- Study editor with Monaco
- Deterministic DSL parser and validation
- Inline learning-focused completions
- Mindmap generation, layout, and SVG rendering
- PNG export and local draft persistence

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

Next.js loads `.env*` files automatically for server-side code. Model provider settings are now defined and validated through [lib/config/env.ts](/Users/owa/code/mindmap/lib/config/env.ts).

Use [.env.example](/Users/owa/code/mindmap/.env.example) as the template for local configuration.

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

## Project Structure

- [app](/Users/owa/code/mindmap/app) contains the Next.js App Router entrypoints.
- [public](/Users/owa/code/mindmap/public) contains static assets.
- [TODO.md](/Users/owa/code/mindmap/TODO.md) tracks the phased implementation plan.

## Development Direction

This app is intentionally not a generic note editor. The completion system is meant to behave like a study assistant:

- stay inside the current topic and branch
- prefer educationally useful additions over generic completions
- suggest the next relevant idea a student should know
- avoid duplication and unsupported tangents

The parser will remain the source of truth for structure. AI should enrich the writing experience, not invent the hierarchy.

## Roadmap

The execution plan is tracked in [TODO.md](/Users/owa/code/mindmap/TODO.md). The current build order is:

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
