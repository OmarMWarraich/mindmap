## TODO: Mindmap Study App MVP

This checklist is organized by execution phase so the app can ship a deterministic editor-to-preview loop first, then layer in AI completion, AI-assisted generation, export, persistence, and hardening.

### Product Goal

The core experience is learning while typing. The user enters topic content from a course book, and the app should suggest relevant continuations, adjacent subtopics, clarifying facts, and likely follow-up ideas that stay tightly aligned with the current subject. The goal is not just to reduce typing, but to help the user discover useful study material beyond the textbook without drifting off-topic or inventing unsupported structure.

### Phase 1 - Project Foundation

- [x] Bootstrap the app with Next.js, React, and TypeScript
Purpose: Creates the base runtime, routing model, and development workflow for the study editor and mindmap experience.

- [x] Set up core dependencies for Monaco, ELK, schema validation, export, and persistence
Purpose: Adds the libraries needed for editing, graph layout, strict AI output handling, PNG download, and local draft storage.

- [x] Create the initial page shell with editor pane, preview pane, and toolbar area
Purpose: Establishes the main user workflow surface so every feature can plug into a stable screen layout.

- [x] Add environment variable loading and validation for model provider configuration
Purpose: Prevents the app from starting with missing or invalid AI credentials and keeps runtime failures easier to diagnose.

- [x] Add scripts for dev, build, lint, test, and typecheck
Purpose: Gives the engineering workflow consistent quality gates from the first commit onward.

### Phase 2 - DSL and Shared Data Contracts

- [x] Define the MVP DSL rules for `@root`, `@branch`, indentation, and leaf nodes
Purpose: Creates a predictable writing format that users can learn quickly and the parser can interpret deterministically.

- [x] Define shared AST types for root, branches, sub-branches, and nodes
Purpose: Gives the parser, generator, and renderer a single structural contract so data stays consistent across the app.

- [x] Define validation result types for warnings and errors
Purpose: Makes malformed input reportable in a structured way instead of relying on ad hoc error strings.

- [x] Define the generated mindmap JSON schema and runtime types
Purpose: Establishes the exact handoff format between parsing, generation, layout, rendering, and AI validation.

- [x] Define the fixed top-level branch color palette and tint rules
Purpose: Ensures each major branch gets a distinct, reusable visual identity in the rendered map.

### Phase 3 - Deterministic Parsing and Validation

- [x] Implement the DSL parser that converts raw outline text into an AST
Purpose: Turns user-authored study notes into reliable structured data the rest of the application can operate on.

- [x] Implement root and branch marker validation
Purpose: Catches structural mistakes early so generation does not silently produce broken or misleading maps.

- [x] Implement indentation and hierarchy validation
Purpose: Prevents ambiguous nesting from producing incorrect parent-child relationships in the mindmap.

- [x] Implement best-effort recovery for partially malformed outlines
Purpose: Allows the app to still produce useful feedback and previews even when the user's outline is imperfect.

- [x] Add parser fixtures for valid outlines, malformed outlines, and edge cases
Purpose: Locks down expected parser behavior so the DSL remains stable as the app evolves.

### Phase 4 - Editor Experience

- [x] Integrate Monaco Editor for the study outline input
Purpose: Provides a robust text-editing surface with the APIs needed for a study-first inline completion experience.

- [x] Seed the editor with helpful starter DSL content
Purpose: Reduces blank-page friction and teaches the expected structure through an example.

- [x] Add debounced parsing on editor changes
Purpose: Keeps validation and preview updates responsive without reprocessing the outline on every keystroke.

- [x] Display structured validation warnings and errors beside the editor
Purpose: Helps users repair broken markup before generating a mindmap.

- [x] Add section-awareness helpers based on cursor location
Purpose: Supplies the completion system with local structural context such as current branch or sub-branch.

- [x] Stub the inline completion integration before connecting the API
Purpose: Lets the editor architecture support ghost text early without blocking on backend AI work.

- [x] Add a study guidance panel or lightweight hint surface next to the editor
Purpose: Gives the user a clear place to see why a suggestion is relevant, what subtopic it expands, or what adjacent concept it helps them learn.

- [x] Distinguish between continuation completions and enrichment completions in the editor UX
Purpose: Keeps simple typing assistance separate from knowledge-expanding suggestions so the learning value stays visible.

### Phase 5 - Deterministic Mindmap Generation

- [x] Convert AST data into the app's mindmap JSON format
Purpose: Creates a working generation pipeline that does not depend on model output to build the graph.

- [x] Assign branch IDs, node IDs, levels, and edges deterministically
Purpose: Guarantees the rendered graph has stable structure and traceable relationships.

- [x] Apply top-level branch colors from the shared palette
Purpose: Makes the visual map easier to scan by preserving color consistency per branch.

- [x] Add anti-cram defaults for spacing, padding, and branch sizing hints
Purpose: Encodes readability constraints before layout runs so dense maps remain usable.

- [x] Add label cleanup and optional grouping rules for overloaded branches
Purpose: Prevents overly long labels or oversized sibling lists from degrading readability.

- [x] Add snapshot tests for AST-to-mindmap generation
Purpose: Protects the core transformation logic from regressions as heuristics are refined.

### Phase 6 - Layout and SVG Rendering

- [x] Translate mindmap JSON into ELK graph input
Purpose: Connects the app's internal graph model to a layout engine that can compute readable positions.

- [x] Run ELK layout in a Web Worker
Purpose: Keeps layout computation off the main thread so typing and UI interactions stay responsive.

- [x] Configure radial layout spacing rules for level distance, sibling gap, and canvas padding
Purpose: Enforces the non-cramped rendering goals that distinguish the product from a generic graph view.

- [x] Build an SVG renderer for nodes, edges, labels, and branch styling
Purpose: Produces a crisp, scalable preview that is also easy to export as an image.

- [x] Add pan and zoom interactions to the preview canvas
Purpose: Makes larger study maps navigable without shrinking everything to unreadable sizes.

- [x] Add loading and failure states around layout computation
Purpose: Prevents the preview from feeling broken when layout work is still running or fails.

### Phase 7 - Inline Completion Service

- [x] Implement the strict inline completion prompt template
Purpose: Constrains the model to short, insertable text that matches the DSL while prioritizing relevant study enrichment over generic wording help.

Reference prompt for implementation:

```text
SYSTEM:
You are an inline study assistant for a structured mindmap editor.
Your job is to help the user learn while they type.
You must suggest the next most relevant piece of study content, not just the next few words.

You ONLY output the exact text to insert at the cursor.
Do not repeat existing text.
Do not explain your reasoning.
Do not add markdown, quotes, bullets that do not match the current DSL, or any surrounding commentary.
If no strong completion is appropriate, output an empty string.

USER:
The user is typing study notes from a course book into a mindmap DSL.
Your goal is to continue the current topic with high-value, on-topic learning content.

Priority order:
1. If the user is clearly finishing a partial label, complete that label.
2. Otherwise, suggest the next most relevant idea that helps the user learn the current topic better.
3. Prefer additions that go slightly beyond the textbook wording while still staying tightly related to the current topic.

Good completions usually include one of these:
- a missing definition
- a key step in a process
- an important input or output
- a cause or effect
- a function or purpose
- a useful example
- a likely subtopic the student should cover next
- a contrast with a nearby related concept

Rules:
- Stay inside the current section, branch, and sub-branch.
- Keep the same indentation and DSL style as the existing text.
- Prefer concise factual phrases suitable for a mindmap node.
- Prefer specific, educationally useful details over generic phrasing.
- Do not introduce unrelated advanced tangents.
- Do not duplicate nearby sibling nodes or recently written ideas.
- Do not invent structure the user has not started unless the context strongly implies the next node belongs there.
- Output at most 2 lines unless the user is clearly writing a multi-line list.
- Keep each added label short, usually 2 to 8 words when possible.

Decision rule:
- Ask: what is the next relevant thing a student should know here?
- If that answer is clear and insertable, output it.
- If not, output an empty string.

CONTEXT WINDOW:
{{LAST_N_TOKENS}}

CURRENT STRUCTURAL CONTEXT:
{{CURRENT_BRANCH_AND_SUBBRANCH}}

CURRENT LINE WITH CURSOR MARKER:
{{CURRENT_LINE_WITH_CURSOR}}
```

- [x] Build context extraction for recent text, line prefix, cursor position, and structural section
Purpose: Gives the completion model only the local context it needs to stay relevant and low-latency.

- [x] Add prompt rules that prefer adjacent concepts, missing subtopics, definitions, inputs/outputs, steps, and examples
Purpose: Guides completions toward the kinds of additions that actually help the user learn more than what is already in the textbook.

- [x] Add the completion API route
Purpose: Centralizes prompt construction, provider access, output filtering, and future operational controls.

- [x] Add response normalization and insertion-only filtering
Purpose: Ensures completions can be shown as ghost text without corrupting the user's outline.

- [x] Add relevance checks that reject off-topic, repetitive, or overly broad completions
Purpose: Prevents the assistant from polluting study notes with low-value suggestions that do not deepen the current topic.

- [x] Add enrichment-vs-duplication checks against nearby sibling nodes
Purpose: Pushes the assistant to contribute new useful information instead of repeating what the user already typed.

- [x] Add caching and rate-limiting hooks for completion requests
Purpose: Keeps the per-keystroke assistance fast and prevents avoidable duplicate model calls.

- [x] Wire Monaco `InlineCompletionsProvider` to the completion endpoint
Purpose: Delivers the study-assistant UX directly inside the editor where learning and note entry happen together.

- [x] Support ghost-text acceptance with Tab and cancellation on rapid edits
Purpose: Makes completions feel natural and unobtrusive rather than disruptive to note-taking flow.

- [x] Add instrumentation to track which suggestions are accepted, ignored, or dismissed
Purpose: Helps tune the system toward completions that genuinely teach and reduce typing instead of merely appearing plausible.

### Phase 8 - AI-Assisted Mindmap Generation

- [x] Implement the strict JSON generation prompt template
Purpose: Tells the model to improve wording and grouping while staying inside the app's exact data contract.

- [x] Add runtime schema validation for model responses
Purpose: Prevents malformed AI output from crashing generation or corrupting the rendered graph.

- [x] Add the generation API route that accepts AST plus raw DSL
Purpose: Creates a controlled server boundary for prompt execution, validation, and future provider changes.

- [x] Merge deterministic structure with AI-cleaned labels and grouping suggestions
Purpose: Preserves trustworthy hierarchy while still benefiting from AI readability improvements.

- [x] Let generation surface optional "suggested missing subtopics" alongside the main map output
Purpose: Helps the user spot gaps in their understanding or in the textbook coverage without silently altering the core authored structure.

- [x] Add best-effort fallback to deterministic generation when AI output is invalid
Purpose: Ensures Generate/Refresh still works even when the model fails or returns unusable JSON.

- [x] Return validation warnings and errors with the generation result
Purpose: Gives users visibility into structural issues without preventing them from seeing a preview.

### Phase 9 - Export and Local Persistence

- [x] Implement SVG or DOM-to-PNG export for the preview canvas
Purpose: Lets users take their generated study map outside the app as a shareable or printable image.

- [x] Add a Download PNG action to the toolbar
Purpose: Exposes export as a primary workflow instead of a hidden developer feature.

- [x] Handle export edge cases such as large maps and clipped bounds
Purpose: Makes exported images reliable for real study use rather than only for simple demos.

- [x] Persist current DSL text and latest generated mindmap locally
Purpose: Prevents students from losing work on refresh or accidental tab closure.

- [x] Restore the saved draft and preview state on app load
Purpose: Makes the app feel dependable and session-aware even before cloud sync exists.

- [x] Persist lightweight UI preferences such as zoom level or panel sizing if needed
Purpose: Improves repeat usability for people who return to the tool often.

### Phase 10 - Hardening and Release Readiness

- [ ] Add end-to-end loading, empty, and error states across editor, completion, generation, layout, and export
Purpose: Keeps the UX understandable when async operations are pending, unavailable, or fail.

- [ ] Add targeted tests for parser, deterministic generation, schema validation, and critical UI flows
Purpose: Covers the highest-risk logic so the MVP can change without breaking core functionality.

- [ ] Add evaluation cases for topic relevance, novelty, and educational usefulness of completions
Purpose: Verifies that the assistant is actually helping the user learn more about the current subject instead of generating generic filler.

- [ ] Add performance safeguards such as debouncing, cancellation, and stale-response protection
Purpose: Prevents rapid typing or repeated generation requests from causing lag or inconsistent UI state.

- [ ] Add telemetry hooks for latency, token usage, and generation failures
Purpose: Creates the observability needed to tune prompt quality, cost, and responsiveness after release.

- [ ] Document setup, environment variables, local run instructions, and MVP scope boundaries
Purpose: Makes the project easier to run, review, and hand off to other engineers.

- [ ] Run a final manual QA pass across typing, generation, layout, export, and persistence
Purpose: Confirms the major user journey works end to end before the MVP is shared or demoed.

---

## UI Redesign — MindFlow AI Workspace

The goal is to convert the current single-page layout into the multi-column SaaS shell shown in the mockup. Work through the phases in order; each phase ships a self-contained, visible improvement.

### Phase A — Design Tokens and Tailwind Theme

- [x] Define the "Cognitive Flow" color palette in `app/globals.css` (`@theme` block — Tailwind v4 CSS-first config)
  Added `primary` (dark blue-grey), `accent` (bright blue), `tertiary` (dark teal), `accent2` (red) as 11-step scales. Neutral uses the built-in zinc scale.
  Purpose: Gives every future component a consistent color vocabulary so the app matches the design system.

- [x] Add Inter as the primary font via `next/font`
  Replaced Geist Sans with Inter in `app/layout.tsx`. `--font-inter` CSS variable wired into the `@theme` `--font-sans` slot. Geist Mono kept for code blocks.
  Purpose: Establishes the typographic tone shown in the mockup.

- [x] Add global CSS resets and base styles matching the mockup
  `html` and `body` set to `height: 100%`; `body` gets `overflow: hidden` and `background-color: #f8fafc`. Updated `app/globals.css`.
  Purpose: Required baseline for a fixed full-viewport layout.

### Phase B — App Shell Layout

- [x] Create `components/AppShell.tsx` — the fixed full-viewport wrapper
  Three-zone layout via `flex flex-col`: `<header>` (`h-14 shrink-0`), then a `flex min-h-0 flex-1` row with `<aside>` (`w-60 shrink-0`) and `<main>` (`flex-1 overflow-y-auto`). Accepts `nav`, `sidebar`, and `children` props so Phases C and D can slot components in without touching the layout.
  Purpose: Replaces the current `<main className="min-h-screen px-6 py-12">` wrapper with the shell all other panels plug into.

- [x] Replace `app/page.tsx` layout with `AppShell`
  Removed the hero section (title, description, MVP badge). Sign-out form and model provider badge live in a temporary `nav` placeholder (will be replaced by `<NavBar>` in Phase C). Sidebar is `null` until Phase D. `<StudyWorkspace>` renders in the `children` slot.
  Purpose: Wires the new shell into the Next.js page so the layout change is visible.

### Phase C — Top Navigation Bar

- [x] Create `components/NavBar.tsx`
  Left: MindFlow SVG icon + wordmark. Center: Workspace / Library / Helpdesk / History `<Link>` tabs with `usePathname` active state. Right: "Model Preview" pill, "Trained Notes" badge, disabled Download icon button, user avatar with initials.
  Purpose: Establishes the global navigation visible in the mockup header.

- [x] Add active-tab routing in `NavBar`
  `usePathname()` drives the active highlight. Workspace (`/`) exact-matches; others use `startsWith`. `href: '#'` tabs are never marked active. Library, Helpdesk, History link to `#` placeholders.
  Purpose: Makes the nav feel interactive without requiring full route build-out.

- [x] Move the sign-out action into the NavBar user-avatar dropdown
  Removed the sign-out form from `app/page.tsx`. A `handleSignOut` Server Action is defined in page.tsx and passed as `signOutAction` prop to `<NavBar>`. Avatar button opens a dropdown with the user's email and a Sign out `<form>`.
  Purpose: Keeps the header clean and places auth actions where the mockup shows them.

### Phase D — Left Sidebar

- [x] Create `components/Sidebar.tsx`
  Top section: project name ("Project Alpha") + subtitle ("Strategy Map"), "Generate Branch" CTA button (accent blue, full width). Navigation list: Notes, Chat, Guides, History — each with an icon and active highlight. Bottom: Settings link and Support link with icons.
  Purpose: Builds the persistent left-panel navigation shown in the mockup.

- [x] Connect sidebar nav items to workspace panel state
  Clicking Notes → show Source Notes panel. Clicking History → open generation history drawer. Chat and Guides can be placeholders for now.
  Purpose: Makes the sidebar functional so the core workflow is navigable.

- [x] Show active project name and subtitle in the sidebar header
  Pull the project name from the existing `projectId` state. Use a placeholder name ("Untitled Project") until a rename feature exists.
  Purpose: Gives the sidebar its contextual header matching the mockup.

### Phase E — Source Notes Panel

- [x] Extract source-notes UI into `components/SourceNotesPanel.tsx`
  Pull the raw-notes textarea, detail-level toggle (Standard / Detailed), Generate DSL button, Clear button, and quality badges out of `StudyWorkspace.tsx` into a standalone component that accepts props and callbacks.
  Purpose: Isolates the notes panel into its own file so layout and state concerns separate cleanly.

- [x] Style `SourceNotesPanel` to match the mockup center column
  White card background, "Source Notes" heading with action icons (search, add-user placeholder), full-height textarea with placeholder text, "Generate Branch" / "Clear" buttons at the bottom of the panel.
  Purpose: Makes the center panel look like the mockup rather than the current sky-blue card.

- [x] Show DSL generation quality feedback inside the panel
  Keep the density status and quality badges but move them to a subtle footer row inside the panel rather than a separate card.
  Purpose: Reduces visual noise while keeping the status information accessible.

### Phase F — DSL Editor Panel

- [x] Extract the Monaco editor into `components/DslEditorPanel.tsx`
  Move the Monaco `<Editor>` block, inline-completion registration, and the Generate mindmap / Reset DSL buttons out of `StudyWorkspace.tsx` into this component.
  Purpose: Gives the editor its own component boundary matching the "DSL Editor" panel in the mockup.

- [x] Add a panel header to `DslEditorPanel` matching the mockup
  "DSL Editor" title on the left, icon buttons on the right (edit, expand/fullscreen placeholder, copy). Use `border-b` to visually separate the header from the editor surface.
  Purpose: Reproduces the panel chrome visible in the mockup.

- [x] Style the DSL editor panel as a dark-bordered card occupying the upper-right quadrant
  The mockup shows the editor filling roughly the top two-thirds of the right column. Constrain height so the Expert Scaling panel fits below it.
  Purpose: Achieves the two-row right column layout.

### Phase G — Expert Scaling Panel

- [x] Extract export controls into `components/ExpertScalingPanel.tsx`
  Move the six scale sliders (`nodeWidthScale`, `nodeHeightScale`, `nodePaddingScale`, `siblingGapScale`, `levelGapScale`, `fontScale`) and the Reset Scaling button out of `StudyWorkspace.tsx` into this component.
  Purpose: Gives the scaling UI its own panel with the "Expert Scaling" header shown in the mockup.

- [x] Style `ExpertScalingPanel` to match the mockup
  Right-aligned value labels next to each slider, thin separator lines between rows, "Reset Scaling" button at the bottom, panel header "Expert Scaling" with a collapse icon.
  Purpose: Makes the scaling panel visually match the mockup.

- [x] Add a bottom action row: Generate DSL | Clear | Quick Export
  Add a sticky footer row inside the right column containing the three action buttons as shown at the bottom of the mockup's right panel.
  Purpose: Puts the primary CTA buttons at the bottom of the panel rather than scattered across multiple cards.

### Phase H — Mindmap Preview Integration

- [x] Decide where the mindmap preview lives in the new layout
  The mockup does not show a preview panel in the main workspace view — it appears to be behind the "Model Preview: Flexible" toggle in the top nav. Add a toggleable preview drawer or a `/preview` sub-route that slides in over the right panels.
  Purpose: Resolves the layout question before implementing the container.

- [x] Integrate `MindmapSvgPreview` into the chosen preview surface
  Move the existing `<MindmapSvgPreview>` usage from the current StudyWorkspace render into the new preview panel. Keep pan/zoom and loading/error states.
  Purpose: Preserves all existing preview functionality in the new UI location.

### Phase I — Generation History Panel

- [x] Convert history from an inline drawer to a sidebar panel
  When the user clicks History in the sidebar nav, replace the Source Notes panel with a history list panel showing the existing `historyEntries` data.
  Purpose: Matches the mockup which shows history as a first-class navigation destination.

- [x] Style history entries to match the mockup list style
  Each entry: timestamp, detail level badge, density status badge, node count, Restore button. Use the same card style as the rest of the app.
  Purpose: Gives the history panel a consistent look.

### Phase J — Chat / Feedback Section

- [x] Create `components/ChatPanel.tsx` as a placeholder
  A minimal panel with a message list and a text input at the bottom. This matches the bottom section of the right panel in the mockup. Wire no AI calls yet — just local message state.
  Purpose: Puts the chat surface in the layout so the full mockup shape is present.

- [x] Integrate the chat panel into the bottom of the right column
  Show it below the Expert Scaling panel or toggle it from the sidebar Chat nav item.
  Purpose: Completes the right-column layout.

### Phase K — Cleanup and Consistency

- [x] Remove old layout wrappers from `StudyWorkspace.tsx`
  After all sub-panels are extracted, `StudyWorkspace.tsx` becomes a thin coordinator that holds state and passes props. Remove any remaining container markup that belongs to the extracted components.
  Purpose: Eliminates duplicated layout logic.

- [x] Audit all Tailwind classes for zinc/sky/emerald overrides
  Replace lingering `bg-sky-*`, `border-sky-*`, `bg-emerald-*` classes with the new design-token utilities defined in Phase A.
  Purpose: Makes the color system consistent across all panels.

- [x] Run `npm run typecheck` and `npm run lint` to confirm no regressions
  Purpose: Validates that the component refactoring did not introduce type errors or lint violations.

- [x] Run existing tests to confirm generation, parsing, and persistence logic is unchanged
  Purpose: Confirms that extracting UI components did not accidentally break any logic that moved with the JSX.

---

## Issue #15 — Multiple Model Providers with User-Selectable Provider/Model

Shift from a deploy-time single provider to request-time model selection backed by multiple server-side credentials. The client sends only an opaque `modelId`; the server resolves provider, base URL, key, and wire format. Initial providers: OpenAI and Anthropic (Claude, native Messages API). Designed so DeepSeek/Kimi can be added later as catalog rows.
Reference: https://github.com/OmarMWarraich/mindmap/issues/15

### Phase 1 — Model Catalog and Adapter Abstraction (no behavior change)

- [x] Add `lib/model/catalog.ts` as the single source of truth for supported models
  Each entry: `id`, `provider`, `wireFormat`, `label`, `roles` (`completion`/`generation`), `capabilities` (e.g. `structuredOutput: 'response_format' | 'tool' | 'prompt'`, `contextWindow`), and `defaults` (`temperature`, `maxTokens`).
  Implemented `modelCatalogEntrySchema` (`.strict()`, derived types via `z.infer`) plus enum constants/schemas for provider, wire format, role, and structured-output strategy. `MODEL_CATALOG` is frozen and self-validates at load via `modelCatalogSchema.parse` (rejects duplicate ids). Seeded OpenAI (`gpt-4o-mini`, `gpt-4o`) and Anthropic (`claude-haiku-4-5`, `claude-sonnet-4-5`) entries. Exposed lookups: `getModelById`, `isKnownModelId`, `listModels`, `listModelsForRole`, `listModelsForProvider`, and `knownModelIdSchema`. Typecheck, lint, and a runtime load check all pass.
  Purpose: Drives the UI dropdown, validates incoming `modelId`, and tells the service how to request structured output.

- [x] Define a `ModelAdapter` interface keyed by wire format
  `buildRequest(opts): { url; init }` and `parseResponse(payload): string`. Adapters are selected by `wireFormat`, not vendor name.
  Added `lib/model/adapter.ts` with the `ModelAdapter` interface (`readonly wireFormat`, `buildRequest(request): ModelHttpRequest`, `parseResponse(payload: unknown): string`) plus wire-format-neutral request types: `ModelChatMessage`, `ModelAdapterCredentials` (server-only `apiKey`/`baseUrl`), `ModelStructuredOutput` (discriminated `json_object` | `json_schema` so each adapter maps to `response_format`/tool/prompt later), and `ModelChatCompletionRequest`. `ModelAdapterRegistry` is `Partial<Record<ModelWireFormat, ModelAdapter>>`; `resolveModelAdapter(registry, wireFormat)` selects by wire format and throws on a missing adapter. Typecheck and lint pass; no existing code touched.
  Purpose: Decouples request/response shape from individual providers so new vendors reuse existing adapters.

- [x] Move `lib/completion/provider.ts` into `lib/model/` and refactor it into the `openai-compatible` adapter
  Preserve current OpenAI/Azure/OpenRouter behavior exactly. Update imports in `lib/completion/service.ts`, `lib/generation/service.ts`, and `lib/generation/source-service.ts`.
  `git mv`d `provider.ts` → `lib/model/openai-compatible-adapter.ts` and `provider.test.ts` → `lib/model/openai-compatible-adapter.test.ts`. Kept the env-based exports (`requestModelProviderChatCompletion`, `buildModelProviderChatCompletionRequest`, `extractAssistantText`, plus the option/message types) byte-for-byte identical so the three services keep their exact behavior — only their import paths changed. Added `openaiCompatibleAdapter` implementing the `ModelAdapter` interface (`buildRequest`/`parseResponse`) for the Bearer protocol, mapping neutral `ModelStructuredOutput` → OpenAI `response_format`. Both the env path and the adapter share one `buildChatCompletionRequestBody` helper to avoid drift. Typecheck and lint clean; the relocated adapter test + all completion tests pass (42/42). (Note: two unrelated `source-*` word-limit tests were already failing on HEAD before this change — 15 vs 35 words — and are untouched here.)
  Purpose: Establishes the shared model home and proves the abstraction with zero behavior change.

- [x] Move hardcoded temperature/max-token defaults out of the provider into per-model catalog defaults
  Removed the magic `temperature ?? 0.2` / `maxCompletionTokens ?? 72` literals from `buildModelProviderChatCompletionRequest`. The catalog is now the single source of truth: added `resolveModelDefaults(modelId)` plus a frozen `FALLBACK_MODEL_DEFAULTS` (`{ temperature: 0.2, maxTokens: 72 }`) to `lib/model/catalog.ts`. The provider resolves the requested model first, then sources `temperature`/`maxCompletionTokens` from that model's catalog `defaults`, falling back to `FALLBACK_MODEL_DEFAULTS` for ids not yet in the catalog (e.g. the current env model `gpt-5-mini`, Azure deployment names, OpenRouter slugs). Behavior is unchanged: the env completion model isn't a catalog id so it still resolves to 0.2/72, and the generation/source services keep passing their explicit per-request budgets (800 and 2200/3200). Typecheck and lint clean; adapter + completion tests pass (42/42).
  Purpose: Lets each model carry its own sensible defaults instead of a single global value.

- [x] Keep all existing provider/service tests green after the refactor
  Verified the full suite after Phase 1: 161/163 pass. Every provider and service test that was green before the refactor is still green — the relocated `openai-compatible-adapter.test.ts`, all `lib/completion/*` tests, and the `lib/generation/*` service tests pass. The only 2 reds are `source-prompt`/`source-service` word-limit assertions (expect "15 words" while the committed prompt says "35 words"); they were already failing on HEAD before this issue's work began and the refactor touches neither the prompt text nor that logic, so they are pre-existing and unrelated — not regressions.
  Purpose: Guarantees the abstraction introduction is behavior-preserving.

### Phase 2 — Anthropic Adapter and Multi-Provider Credentials

- [x] Implement the `anthropic-messages` adapter
  `x-api-key` + `anthropic-version` headers, top-level `system`, `messages` (user/assistant only), `max_tokens`, and `content[]` response parsing.
  Added `lib/model/anthropic-messages-adapter.ts` exporting `anthropicMessagesAdapter` (`wireFormat: 'anthropic-messages'`). `buildRequest` posts to `{baseUrl}/messages` (default `https://api.anthropic.com/v1`) with `x-api-key`, `anthropic-version: 2023-06-01`, and `Content-Type` headers; it lifts all `system` turns into the top-level `system` string (joined by blank lines, omitted when absent) and keeps only `user`/`assistant` turns in `messages`, alongside `model`, `max_tokens`, and `temperature`. Neutral `ModelStructuredOutput` maps to Anthropic's idiomatic forced tool call (`tools` + `tool_choice: { type: 'tool' }`) — `json_schema` → a named tool with `input_schema`/`strict`, `json_object` → a permissive `json_output` tool. `parseResponse` (via exported `extractAnthropicText`) concatenates `text` content blocks, or returns a `tool_use` block's `input` as a JSON string so callers parse it exactly like the OpenAI path. Verified against the live Anthropic Messages API reference. Typecheck and lint clean; 9/9 new adapter tests pass.
  Purpose: Adds first-class native Claude support beyond the OpenAI-compatibility shim.

- [x] Replace single-key env with per-provider credentials validated lazily
  Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (and a commented `DEEPSEEK_API_KEY` placeholder). Validate a provider's key only when one of its models is used. Update `lib/config/env.ts`.
  Added a per-provider credential layer to `lib/config/env.ts` alongside the still-active legacy `MODEL_*` path (migrated away in Phase 3). A `PROVIDER_API_KEY_ENV_VARS` map (`openai → OPENAI_API_KEY`, `anthropic → ANTHROPIC_API_KEY`) uses `satisfies Record<ModelProvider, string>` so adding a catalog provider forces a mapping entry; a comment documents the OpenAI-compatible `DEEPSEEK_API_KEY` placeholder for the later catalog row. Three new exports: `getProviderApiKeyEnvVarName(provider)`, `isProviderConfigured(provider, env?)` (non-throwing, for deriving availability), and `getProviderCredentials(provider, env?): ModelAdapterCredentials` which validates the key lazily — only when that provider's model is requested — reusing the existing `requiredValue` placeholder/blank guard and throwing a `Set <VAR> to use <provider> models` error otherwise. The `env` params accept a plain record so callers (and tests) can pass partial environments. New `lib/config/env.test.ts` covers mapping, configured/placeholder/blank/missing detection, trimmed-key resolution, the descriptive throw, and per-provider laziness (6/6 pass). Typecheck and lint clean.
  Purpose: Lets the server hold multiple providers' credentials without forcing every key to be set.

- [x] Derive provider availability from configured keys
  A provider is "available" only when its key is present; `catalog × configured providers` = the models the UI may show.
  Added `lib/model/availability.ts` bridging the static catalog with the per-provider key checks from Phase 2's `isProviderConfigured`. Exports: `listConfiguredProviders(env?)` (filters `MODEL_PROVIDERS` to those with a configured key), `listAvailableModels(env?)` and `listAvailableModelsForRole(role, env?)` (catalog × configured providers), and `isModelAvailable(modelId, env?)` (model exists in the catalog *and* its provider is configured; unknown ids → false). All accept an optional env record defaulting to `process.env`, so routes and the upcoming `/api/models` endpoint can compute the offerable model list without exposing keys. The module sits in `lib/model/` (not the pure-data `catalog.ts`) to keep the catalog free of env imports — no cycle: availability → env (types only) → catalog. New `lib/model/availability.test.ts` covers configured-provider filtering, catalog intersection, role+provider filtering, the all-keys and no-keys cases, and unknown-id rejection (7/7 pass). Typecheck and lint clean.
  Purpose: Prevents offering models the server cannot actually call.

- [x] Update `.env.example` and document the new per-provider variables
  Restructured [.env.example](.env.example) into a "Model provider credentials" block: `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are now first-class entries with a comment explaining lazy per-provider validation, followed by the commented `DEEPSEEK_API_KEY` placeholder. The legacy `MODEL_*` vars are grouped under a "Legacy single-provider model config (transitional)" comment (kept commented, still consumed until request-time selection lands). Removed the duplicate per-provider keys that had been appended at the bottom of the file. Updated [README.md](README.md) Environment Variables section with a per-provider-keys subsection (which key maps to which catalog models, lazy validation, unconfigured providers being hidden) plus the legacy block marked transitional.
  Purpose: Keeps onboarding accurate after the env schema change.

### Phase 3 — Thread `modelId` Through the Request Contract

- [x] Add optional `modelId` to the completion, generation, and source `.strict()` request schemas
  Added `modelId: knownModelIdSchema.optional()` to `inlineCompletionRequestSchema` ([lib/completion/service.ts](lib/completion/service.ts)), `generationRequestSchema` ([lib/generation/service.ts](lib/generation/service.ts)), and `sourceMindmapGenerationRequestSchema` ([lib/generation/source-schema.ts](lib/generation/source-schema.ts)), importing `knownModelIdSchema` from the catalog in each. Reusing the catalog schema means an unknown id is rejected at the contract boundary while omission stays valid (backward-compatible); provider-configured + allow-list checks come in the next item. All three keep `.strict()`. New [lib/model/request-model-id.test.ts](lib/model/request-model-id.test.ts) asserts the omitted case still validates, known catalog ids (`gpt-4o-mini`, `claude-sonnet-4-5`, `gpt-4o`) are accepted, and unknown ids are rejected across all three schemas (3/3 pass). Typecheck and lint clean; completion/generation suites 62/63 (the lone failure is the pre-existing unrelated 35-word-limit test).
  Purpose: Lets the client express a model choice while staying backward-compatible.

- [x] Validate and authorize `modelId` server-side in each route
  Added [lib/model/authorization.ts](lib/model/authorization.ts) with `authorizeModelId(modelId, { role?, env? })`, which runs four server-side gates and returns a discriminated `{ ok: true; modelId } | { ok: false; status: 400 | 403; reason }`: (1) catalog existence via `getModelById` (defense-in-depth behind the schema's `knownModelIdSchema`) → 400 for an unknown id; (2) role support (`entry.roles.includes(role)`) so a generation-only model cannot be used on the completion route → 403; (3) an ops-controlled allow-list (`isModelAllowListed`/`getModelAllowList`) read from the optional comma-separated `MODEL_ALLOWLIST` env var, defaulting to all catalog ids when unset/blank → 403 when disallowed; (4) provider-configured via `isModelAvailable` → 403 when the provider key is missing. Wired into all three AI routes ([app/api/completion/route.ts](app/api/completion/route.ts) with `role: 'completion'`, [app/api/generation/route.ts](app/api/generation/route.ts) and [app/api/generation/dsl/route.ts](app/api/generation/dsl/route.ts) with `role: 'generation'`): after schema parse, when `payload.modelId` is present the route authorizes it and short-circuits with `Response.json({ error: reason }, { status })` on failure before dispatching. Omitted `modelId` is untouched (per-role default fallback is the next item). New [lib/model/authorization.test.ts](lib/model/authorization.test.ts) covers accept, unknown→400, provider-not-configured→403, unsupported-role→403, `MODEL_ALLOWLIST` enforcement, and allow-list helpers (7/7 pass). Typecheck and lint clean.
  Purpose: Prevents clients from invoking arbitrary or disallowed models.

- [x] Resolve credentials and adapter server-side from the validated `modelId`
  Added [lib/model/resolve.ts](lib/model/resolve.ts) with `resolveModel(modelId, { env?, registry? }): ResolvedModel`, the server-side bridge from a validated catalog id to a dispatchable request. It looks up the catalog entry (`getModelById`), selects the wire-format adapter via `resolveModelAdapter` against a `defaultModelAdapterRegistry` that maps `openai-compatible` → `openaiCompatibleAdapter` and `anthropic-messages` → `anthropicMessagesAdapter` (keyed by wire format, not vendor), and resolves the provider's `ModelAdapterCredentials` through `getProviderCredentials(entry.provider, env)` — so keys and base URLs come only from server env, never the client request, and are never returned to it. `ResolvedModel` exposes `{ entry, adapter, credentials }`, giving callers the model name, defaults, and capabilities (from `entry`) plus the adapter and creds needed for the upcoming dispatch rewire. Throws for an unknown id, an unregistered wire format, or a missing provider key (the last surfaced by `getProviderCredentials`). The optional `env`/`registry` params keep it injectable for tests. New [lib/model/resolve.test.ts](lib/model/resolve.test.ts) covers OpenAI + Anthropic resolution, the unknown-id throw, the missing-key throw, the empty-registry throw, and the default registry mapping (6/6 pass). Typecheck and lint clean.
  Purpose: Ensures keys and base URLs are never accepted from or exposed to the client.

- [x] Fall back to a per-role default model when `modelId` is absent
  Added a frozen `DEFAULT_MODEL_IDS` map to [lib/model/catalog.ts](lib/model/catalog.ts) (`completion → gpt-4o-mini`, `generation → gpt-4o` — both OpenAI, so they resolve whenever `OPENAI_API_KEY` is set; completion favors a cheap/fast model, generation a stronger one), guarded by a module-load invariant that throws if a default isn't a known catalog id (fail-fast on a typo instead of a runtime "unknown model id" on the first defaulted request). Exposed `getDefaultModelIdForRole(role)` and the pure `selectModelIdForRole(role, requestedModelId?)` (= `requestedModelId ?? default`, no env/credentials so it can also key caches/logs by the effective model — used by the next cache-key item). Added `resolveModelForRole(role, requestedModelId, options?)` to [lib/model/resolve.ts](lib/model/resolve.ts), which feeds `selectModelIdForRole` into `resolveModel` so callers never special-case the "no model chosen" path. No running service was rewired, so current behavior and existing tests are unchanged — this only supplies the default-selection layer the dispatch path will adopt. New [lib/model/role-defaults.test.ts](lib/model/role-defaults.test.ts) covers default validity, per-role defaults, fallback vs. explicit selection, and `resolveModelForRole` resolving both the default and a requested id (6/6 pass; resolve suite 12/12 together). Typecheck and lint clean.
  Purpose: Preserves current behavior and keeps existing tests passing.

- [x] Include `modelId` in `createInlineCompletionCacheKey` (`lib/completion/runtime-controls.ts`)
  Prepended the effective model id to the cache-key tuple in [lib/completion/runtime-controls.ts](lib/completion/runtime-controls.ts) via `selectModelIdForRole('completion', request.modelId)`, so a completion cached for one model is never served for another. Resolving the per-role default here (rather than keying on the raw optional `modelId`) means an omitted `modelId` and an explicit default-equal id collapse to the same entry — correct, since they dispatch to the same model — while distinct models get distinct keys. Extended [lib/completion/runtime-controls.test.ts](lib/completion/runtime-controls.test.ts) with two cases: different `modelId`s on identical context produce different keys, and an omitted `modelId` matches the `gpt-4o-mini` completion default (6/6 pass). Typecheck and lint clean.
  Purpose: Stops one model's cached completion from being served for another model.

### Phase 4 — Capability-Aware Structured Output

- [x] Select the structured-output strategy from catalog capabilities
  Added a shared capability-aware dispatcher [lib/model/dispatch.ts](lib/model/dispatch.ts) — `requestStructuredModelCompletion({ role, modelId?, messages, maxTokens, temperature?, structuredOutput?, env?, registry?, fetchImpl? })`. It resolves the model via `resolveModelForRole` (honoring an explicit `modelId` or the role default), reads `entry.capabilities.structuredOutput`, and applies the neutral `structuredOutput` intent **only** when the strategy is native (`response_format`/`tool`); for `prompt`-capability models it omits it so the caller leans on prompt instructions + a robust parse (next item). The wire-format adapter then translates the neutral intent to the provider's mechanism — `openaiCompatibleAdapter` → OpenAI `response_format`, `anthropicMessagesAdapter` → Anthropic `tools` + `tool_choice` — and `parseResponse` normalizes the reply, so a provider swap can't silently break or degrade DSL generation. Returns `{ text, modelId, structuredOutputStrategy }`. Rewired both generation services off the legacy single-provider env path: [lib/generation/service.ts](lib/generation/service.ts) `generateMindmapOverlay` and [lib/generation/source-service.ts](lib/generation/source-service.ts) `generateDslAttempt` now call the dispatcher with `role: 'generation'` and thread the request's `modelId` + an env record (dropping `getModelProviderEnv()`/`MODEL_GENERATION_MODEL`); their options `env` type changed from `ModelProviderEnv` to `Record<string, string | undefined>`. Behavior for the default path is preserved (generation default `gpt-4o` is OpenAI/`response_format`, same request body + `choices[]` parsing). New [lib/model/dispatch.test.ts](lib/model/dispatch.test.ts) asserts the OpenAI path emits `response_format` (no `tools`) and parses `choices`, the Anthropic path emits `tools`/`tool_choice` (no `response_format`) and parses `tool_use` input, and the role-default fallback (3/3 pass). Updated [lib/generation/source-service.test.ts](lib/generation/source-service.test.ts) to the per-provider `{ OPENAI_API_KEY }` env. Typecheck and lint clean; model + generation + completion suites 110/111 (the lone red is the pre-existing, unrelated 35-word-limit test that was already failing on HEAD).
  Purpose: Ensures a provider swap does not silently break or degrade DSL generation.

- [ ] Add a robust JSON parse fallback for prompt-only structured output
  Purpose: Supports models lacking native structured-output features.

### Phase 5 — UI Selector and Persistence

- [ ] Add a `/api/models` endpoint returning catalog metadata filtered to configured providers
  Expose only non-secret fields; never return keys or base URLs.
  Purpose: Lets the client render the dropdown without hardcoding the model list or seeing secrets.

- [ ] Add a reusable provider-grouped `ModelSelector` component
  Purpose: Provides the shared UI control for picking a provider/model.

- [ ] Wire separate completion-model and generation-model selections into the workspace
  Purpose: Allows a cheap/fast model for inline completion and a stronger model for generation.

- [ ] Persist the user's model choices
  localStorage for MVP; later user/project settings via the existing persistence layer.
  Purpose: Keeps the selection across reloads and (eventually) across devices.

### Phase 6 — Extensibility Validation and Hardening

- [ ] Add DeepSeek and Kimi as catalog rows (OpenAI-compatible)
  Purpose: Proves a new model requires only a catalog entry plus a key.

- [ ] Add per-wire-format adapter tests and per-provider service tests
  Extend `lib/completion/provider.test.ts` and `lib/generation/source-service.test.ts`.
  Purpose: Locks in correct request/response handling for each wire format.

- [ ] Consider per-provider rate limiting
  Purpose: Avoids one provider's limits affecting another and controls cost.

- [ ] Rotate the OpenAI key currently in `.env.local` and confirm `.env.local` is gitignored
  Purpose: Removes a committed secret and prevents future leakage.

### Out of Scope (for this issue)

- Streaming responses.
- Per-org/per-user bring-your-own API keys.
- Provider-specific advanced features beyond chat + structured output.