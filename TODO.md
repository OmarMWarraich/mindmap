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

- [ ] Create `components/NavBar.tsx`
  Left: "MindFlow" wordmark with a small icon. Center: tab row — Workspace, Library, Helpdesk, History (router-driven active state). Right: "Model Preview" pill showing the active provider, a "Trained Notes" badge, user avatar, Download icon button, settings dots menu. Use `h-14 border-b` styling.
  Purpose: Establishes the global navigation visible in the mockup header.

- [ ] Add active-tab routing in `NavBar`
  Use `usePathname` to highlight the active tab. For now only Workspace (`/`) is a real route; the others can be inert or link to `#` placeholders.
  Purpose: Makes the nav feel interactive without requiring full route build-out.

- [ ] Move the sign-out action into the NavBar user-avatar dropdown
  Remove the sign-out form from `app/page.tsx` and add it to the avatar menu in `NavBar`.
  Purpose: Keeps the header clean and places auth actions where the mockup shows them.

### Phase D — Left Sidebar

- [ ] Create `components/Sidebar.tsx`
  Top section: project name ("Project Alpha") + subtitle ("Strategy Map"), "Generate Branch" CTA button (accent blue, full width). Navigation list: Notes, Chat, Guides, History — each with an icon and active highlight. Bottom: Settings link and Support link with icons.
  Purpose: Builds the persistent left-panel navigation shown in the mockup.

- [ ] Connect sidebar nav items to workspace panel state
  Clicking Notes → show Source Notes panel. Clicking History → open generation history drawer. Chat and Guides can be placeholders for now.
  Purpose: Makes the sidebar functional so the core workflow is navigable.

- [ ] Show active project name and subtitle in the sidebar header
  Pull the project name from the existing `projectId` state. Use a placeholder name ("Untitled Project") until a rename feature exists.
  Purpose: Gives the sidebar its contextual header matching the mockup.

### Phase E — Source Notes Panel

- [ ] Extract source-notes UI into `components/SourceNotesPanel.tsx`
  Pull the raw-notes textarea, detail-level toggle (Standard / Detailed), Generate DSL button, Clear button, and quality badges out of `StudyWorkspace.tsx` into a standalone component that accepts props and callbacks.
  Purpose: Isolates the notes panel into its own file so layout and state concerns separate cleanly.

- [ ] Style `SourceNotesPanel` to match the mockup center column
  White card background, "Source Notes" heading with action icons (search, add-user placeholder), full-height textarea with placeholder text, "Generate Branch" / "Clear" buttons at the bottom of the panel.
  Purpose: Makes the center panel look like the mockup rather than the current sky-blue card.

- [ ] Show DSL generation quality feedback inside the panel
  Keep the density status and quality badges but move them to a subtle footer row inside the panel rather than a separate card.
  Purpose: Reduces visual noise while keeping the status information accessible.

### Phase F — DSL Editor Panel

- [ ] Extract the Monaco editor into `components/DslEditorPanel.tsx`
  Move the Monaco `<Editor>` block, inline-completion registration, and the Generate mindmap / Reset DSL buttons out of `StudyWorkspace.tsx` into this component.
  Purpose: Gives the editor its own component boundary matching the "DSL Editor" panel in the mockup.

- [ ] Add a panel header to `DslEditorPanel` matching the mockup
  "DSL Editor" title on the left, icon buttons on the right (edit, expand/fullscreen placeholder, copy). Use `border-b` to visually separate the header from the editor surface.
  Purpose: Reproduces the panel chrome visible in the mockup.

- [ ] Style the DSL editor panel as a dark-bordered card occupying the upper-right quadrant
  The mockup shows the editor filling roughly the top two-thirds of the right column. Constrain height so the Expert Scaling panel fits below it.
  Purpose: Achieves the two-row right column layout.

### Phase G — Expert Scaling Panel

- [ ] Extract export controls into `components/ExpertScalingPanel.tsx`
  Move the six scale sliders (`nodeWidthScale`, `nodeHeightScale`, `nodePaddingScale`, `siblingGapScale`, `levelGapScale`, `fontScale`) and the Reset Scaling button out of `StudyWorkspace.tsx` into this component.
  Purpose: Gives the scaling UI its own panel with the "Expert Scaling" header shown in the mockup.

- [ ] Style `ExpertScalingPanel` to match the mockup
  Right-aligned value labels next to each slider, thin separator lines between rows, "Reset Scaling" button at the bottom, panel header "Expert Scaling" with a collapse icon.
  Purpose: Makes the scaling panel visually match the mockup.

- [ ] Add a bottom action row: Generate DSL | Clear | Quick Export
  Add a sticky footer row inside the right column containing the three action buttons as shown at the bottom of the mockup's right panel.
  Purpose: Puts the primary CTA buttons at the bottom of the panel rather than scattered across multiple cards.

### Phase H — Mindmap Preview Integration

- [ ] Decide where the mindmap preview lives in the new layout
  The mockup does not show a preview panel in the main workspace view — it appears to be behind the "Model Preview: Flexible" toggle in the top nav. Add a toggleable preview drawer or a `/preview` sub-route that slides in over the right panels.
  Purpose: Resolves the layout question before implementing the container.

- [ ] Integrate `MindmapSvgPreview` into the chosen preview surface
  Move the existing `<MindmapSvgPreview>` usage from the current StudyWorkspace render into the new preview panel. Keep pan/zoom and loading/error states.
  Purpose: Preserves all existing preview functionality in the new UI location.

### Phase I — Generation History Panel

- [ ] Convert history from an inline drawer to a sidebar panel
  When the user clicks History in the sidebar nav, replace the Source Notes panel with a history list panel showing the existing `historyEntries` data.
  Purpose: Matches the mockup which shows history as a first-class navigation destination.

- [ ] Style history entries to match the mockup list style
  Each entry: timestamp, detail level badge, density status badge, node count, Restore button. Use the same card style as the rest of the app.
  Purpose: Gives the history panel a consistent look.

### Phase J — Chat / Feedback Section

- [ ] Create `components/ChatPanel.tsx` as a placeholder
  A minimal panel with a message list and a text input at the bottom. This matches the bottom section of the right panel in the mockup. Wire no AI calls yet — just local message state.
  Purpose: Puts the chat surface in the layout so the full mockup shape is present.

- [ ] Integrate the chat panel into the bottom of the right column
  Show it below the Expert Scaling panel or toggle it from the sidebar Chat nav item.
  Purpose: Completes the right-column layout.

### Phase K — Cleanup and Consistency

- [ ] Remove old layout wrappers from `StudyWorkspace.tsx`
  After all sub-panels are extracted, `StudyWorkspace.tsx` becomes a thin coordinator that holds state and passes props. Remove any remaining container markup that belongs to the extracted components.
  Purpose: Eliminates duplicated layout logic.

- [ ] Audit all Tailwind classes for zinc/sky/emerald overrides
  Replace lingering `bg-sky-*`, `border-sky-*`, `bg-emerald-*` classes with the new design-token utilities defined in Phase A.
  Purpose: Makes the color system consistent across all panels.

- [ ] Run `npm run typecheck` and `npm run lint` to confirm no regressions
  Purpose: Validates that the component refactoring did not introduce type errors or lint violations.

- [ ] Run existing tests to confirm generation, parsing, and persistence logic is unchanged
  Purpose: Confirms that extracting UI components did not accidentally break any logic that moved with the JSX.