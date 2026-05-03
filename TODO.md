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

- [ ] Let generation surface optional "suggested missing subtopics" alongside the main map output
Purpose: Helps the user spot gaps in their understanding or in the textbook coverage without silently altering the core authored structure.

- [ ] Add best-effort fallback to deterministic generation when AI output is invalid
Purpose: Ensures Generate/Refresh still works even when the model fails or returns unusable JSON.

- [ ] Return validation warnings and errors with the generation result
Purpose: Gives users visibility into structural issues without preventing them from seeing a preview.

### Phase 9 - Export and Local Persistence

- [ ] Implement SVG or DOM-to-PNG export for the preview canvas
Purpose: Lets users take their generated study map outside the app as a shareable or printable image.

- [ ] Add a Download PNG action to the toolbar
Purpose: Exposes export as a primary workflow instead of a hidden developer feature.

- [ ] Handle export edge cases such as large maps and clipped bounds
Purpose: Makes exported images reliable for real study use rather than only for simple demos.

- [ ] Persist current DSL text and latest generated mindmap locally
Purpose: Prevents students from losing work on refresh or accidental tab closure.

- [ ] Restore the saved draft and preview state on app load
Purpose: Makes the app feel dependable and session-aware even before cloud sync exists.

- [ ] Persist lightweight UI preferences such as zoom level or panel sizing if needed
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