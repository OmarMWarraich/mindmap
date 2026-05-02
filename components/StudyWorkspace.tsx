'use client';

import Editor from '@monaco-editor/react';
import { startTransition, useEffect, useMemo, useState } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor, languages } from 'monaco-editor';

import { getMindmapSectionContext } from '../lib/dsl/editor-context';
import {
  createInlineSuggestionRange,
  getStubInlineSuggestionSet,
  pickPreferredStubSuggestion,
} from '../lib/dsl/inline-completion';
import { parseMindmapDsl } from '../lib/dsl/parse';
import { mindmapDslStarterOutline } from '../lib/dsl/mvp';
import type { MindmapValidationIssue } from '../lib/dsl/validation';

let mindmapDslInlineCompletionRegistered = false;
const mindmapDslLanguageId = 'mindmap-dsl';
let mindmapDslInlineSuggestionPreference: InlineSuggestionPreference = 'auto';

type InlineSuggestionPreference = 'auto' | 'continuation' | 'enrichment';

const editorLoadingFallback = (
  <div className="flex h-[460px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-sm text-zinc-500">
    Loading Monaco editor...
  </div>
);

export default function StudyWorkspace() {
  const [outline, setOutline] = useState(mindmapDslStarterOutline);
  const [debouncedOutline, setDebouncedOutline] = useState(mindmapDslStarterOutline);
  const [isParsing, setIsParsing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [inlineSuggestionPreference, setInlineSuggestionPreference] =
    useState<InlineSuggestionPreference>('auto');

  useEffect(() => {
    setIsParsing(true);

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setDebouncedOutline(outline);
        setIsParsing(false);
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [outline]);

  const parseResult = useMemo(() => parseMindmapDsl(debouncedOutline), [debouncedOutline]);
  const sectionContext = useMemo(
    () => getMindmapSectionContext(outline, cursorPosition),
    [cursorPosition, outline],
  );
  const stubSuggestionSet = useMemo(
    () => getStubInlineSuggestionSet(sectionContext),
    [sectionContext],
  );
  const preferredStubSuggestion = useMemo(
    () => pickPreferredStubSuggestion(stubSuggestionSet, inlineSuggestionPreference),
    [inlineSuggestionPreference, stubSuggestionSet],
  );
  const branchCount = parseResult.ast?.root.branches.length ?? 0;
  const nodeCount = (parseResult.ast?.root.branches ?? []).reduce((count, branch) => {
    const countChildren = (children: typeof branch.children): number => {
      return children.reduce((total, child) => total + 1 + countChildren(child.children), 0);
    };

    return count + 1 + countChildren(branch.children);
  }, 1);

  useEffect(() => {
    mindmapDslInlineSuggestionPreference = inlineSuggestionPreference;
  }, [inlineSuggestionPreference]);

  return (
    <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Toolbar area</h2>
          <p className="text-sm leading-6 text-zinc-600">
            Generate, refresh, export, and status controls will live here.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700">
            {isParsing ? 'Parsing…' : `Parsed ${nodeCount} nodes`}
          </span>
          <button className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800">
            Generate mindmap
          </button>
          <button className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100">
            Refresh preview
          </button>
          <button className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100">
            Download PNG
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold text-zinc-950">Study editor</h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              Monaco now hosts the study outline directly in the app shell so later
              parsing, completions, and preview updates can build on the real editor.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <p className="text-sm font-medium text-emerald-900">Starter outline loaded</p>
              <p className="text-sm leading-6 text-emerald-800/80">
                The editor opens with a working DSL example so users can learn the
                format from a concrete root, branch, and nested leaf structure.
              </p>
            </div>

            <button
              className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
              onClick={() => {
                setOutline(mindmapDslStarterOutline);
              }}
              type="button"
            >
              Reset starter outline
            </button>
          </div>

          <div className="h-[460px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <Editor
              beforeMount={configureMindmapDslMonaco}
              defaultLanguage={mindmapDslLanguageId}
              height="100%"
              loading={editorLoadingFallback}
              onChange={(value) => {
                setOutline(value ?? '');
              }}
              onMount={(editor) => {
                const position = editor.getPosition();

                if (position) {
                  setCursorPosition(position);
                }

                editor.onDidChangeCursorPosition((event) => {
                  setCursorPosition(event.position);
                });
              }}
              options={{
                automaticLayout: true,
                glyphMargin: false,
                inlineSuggest: { enabled: true },
                minimap: { enabled: false },
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
              path="mindmap://study-outline.dsl"
              theme="light"
              value={outline}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ValidationPanel
              issues={parseResult.errors}
              tone="error"
              title={`Errors (${parseResult.errors.length})`}
            />
            <ValidationPanel
              issues={parseResult.warnings}
              tone="warning"
              title={`Warnings (${parseResult.warnings.length})`}
            />
          </div>
        </section>

        <aside className="grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold text-zinc-950">Mindmap preview</h2>
            <p className="text-sm leading-6 text-zinc-600">
              Layout output, branch colours, and export bounds will render in this
              panel once the deterministic generation pipeline is connected.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700">
                {parseResult.ast ? 'AST ready' : 'Awaiting valid root'}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700">
                {branchCount} branches
              </span>
            </div>
            <p className="leading-6 text-zinc-600">
              {parseResult.ast
                ? `Current topic: ${parseResult.ast.root.label}`
                : 'The parser will resume once the outline contains a valid root declaration.'}
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 font-medium text-sky-900">
                Cursor line {sectionContext.cursor.lineNumber}
              </span>
              <span className="rounded-full bg-white px-3 py-1 font-medium text-sky-900">
                {sectionContext.currentLineKind}
              </span>
            </div>
            <p className="leading-6 text-sky-900/80">
              {sectionContext.branchLabel
                ? `Active branch: ${sectionContext.branchLabel}`
                : 'Move into a branch to get section-aware study help.'}
            </p>
            <p className="leading-6 text-sky-900/80">
              {sectionContext.subBranchTrail.length > 0
                ? `Sub-branch trail: ${sectionContext.subBranchTrail.join(' / ')}`
                : 'No nested sub-branch is active at the current cursor position.'}
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
            <div className="grid gap-1">
              <h3 className="text-base font-semibold text-emerald-950">Study guidance</h3>
              <p className="leading-6 text-emerald-900/80">
                This hint surface explains what the stub assistant is trying to add in
                the current section before the API-backed model is connected.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['auto', 'continuation', 'enrichment'] as InlineSuggestionPreference[]).map((mode) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    inlineSuggestionPreference === mode
                      ? 'bg-emerald-950 text-emerald-50'
                      : 'border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100'
                  }`}
                  key={mode}
                  onClick={() => {
                    setInlineSuggestionPreference(mode);
                  }}
                  type="button"
                >
                  {mode === 'auto' ? 'Auto' : mode}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Current focus
              </p>
              <p className="mt-2 leading-6 text-emerald-950">
                {sectionContext.branchLabel
                  ? `${sectionContext.branchLabel}${
                      sectionContext.subBranchTrail.length > 0
                        ? ` -> ${sectionContext.subBranchTrail.join(' -> ')}`
                        : ''
                    }`
                  : sectionContext.rootLabel ?? 'Start with a root topic'}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <SuggestionCard
                active={inlineSuggestionPreference === 'continuation'}
                label="Continuation"
                suggestion={stubSuggestionSet.continuation}
              />
              <SuggestionCard
                active={inlineSuggestionPreference === 'enrichment'}
                label="Enrichment"
                suggestion={stubSuggestionSet.enrichment}
              />
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Active ghost text
              </p>
              <p className="mt-2 rounded-xl bg-emerald-950 px-3 py-2 font-mono text-sm text-emerald-50">
                {preferredStubSuggestion?.insertText || 'No inline hint for this cursor position.'}
              </p>
              <p className="mt-3 leading-6 text-emerald-900/80">
                {preferredStubSuggestion?.explanation || 'Move the cursor into a partial label or a blank study slot to preview a hint.'}
              </p>
            </div>
          </div>

          <div className="grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
            <div className="grid max-w-sm gap-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                <span className="text-2xl">◎</span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-950">Preview placeholder</h3>
              <p className="text-sm leading-6 text-zinc-600">
                The live editor now mounts on the left. The generated radial map will
                appear here after the parser, layout engine, and SVG renderer are wired.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ValidationPanel({
  issues,
  title,
  tone,
}: {
  issues: MindmapValidationIssue[];
  title: string;
  tone: 'error' | 'warning';
}) {
  const palette = tone === 'error'
    ? {
        badge: 'bg-rose-100 text-rose-700',
        border: 'border-rose-200',
        subtle: 'text-rose-900',
      }
    : {
        badge: 'bg-amber-100 text-amber-700',
        border: 'border-amber-200',
        subtle: 'text-amber-900',
      };

  return (
    <section className={`grid gap-3 rounded-2xl border bg-white p-4 ${palette.border}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${palette.badge}`}>
          {issues.length === 0 ? 'clear' : 'active'}
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm leading-6 text-zinc-500">
          {tone === 'error'
            ? 'No blocking parser errors in the current outline.'
            : 'No parser warnings in the current outline.'}
        </p>
      ) : (
        <ul className="grid gap-2">
          {issues.map((issue, index) => (
            <li
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
              key={`${issue.code}-${issue.target.source?.line ?? 'unknown'}-${index}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                <span>{issue.code}</span>
                <span className={palette.subtle}>
                  {formatIssueLocation(issue)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{issue.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatIssueLocation(issue: MindmapValidationIssue): string {
  const line = issue.target.source?.line;
  const column = issue.target.source?.column;

  if (line == null) {
    return 'document-level';
  }

  return column == null ? `line ${line}` : `line ${line}, col ${column}`;
}

function configureMindmapDslMonaco(monaco: Monaco): void {
  if (
    !monaco.languages
      .getLanguages()
      .some((language: languages.ILanguageExtensionPoint) => language.id === mindmapDslLanguageId)
  ) {
    monaco.languages.register({ id: mindmapDslLanguageId });
  }

  if (mindmapDslInlineCompletionRegistered) {
    return;
  }

  monaco.languages.registerInlineCompletionsProvider(mindmapDslLanguageId, {
    provideInlineCompletions(
      model: editor.ITextModel,
      position: { lineNumber: number; column: number },
    ) {
      const sectionContext = getMindmapSectionContext(model.getValue(), {
        lineNumber: position.lineNumber,
        column: position.column,
      });
      const suggestion = pickPreferredStubSuggestion(
        getStubInlineSuggestionSet(sectionContext),
        mindmapDslInlineSuggestionPreference,
      );
      if (!suggestion || suggestion.insertText.length === 0) {
        return { items: [] };
      }

      return {
        items: [
          {
            insertText: suggestion.insertText,
            range: createInlineSuggestionRange(position),
          },
        ],
      };
    },
    disposeInlineCompletions() {},
    displayName: 'Mindmap study stub',
  });

  mindmapDslInlineCompletionRegistered = true;
}

function SuggestionCard({
  active,
  label,
  suggestion,
}: {
  active: boolean;
  label: string;
  suggestion: ReturnType<typeof getStubInlineSuggestionSet>['continuation'];
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 ${
        active ? 'border-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]' : 'border-emerald-200'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {label}
        </p>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
          {active ? 'active' : 'available'}
        </span>
      </div>
      <p className="mt-2 rounded-xl bg-emerald-950 px-3 py-2 font-mono text-sm text-emerald-50">
        {suggestion?.insertText || 'No suggestion'}
      </p>
      <p className="mt-3 leading-6 text-emerald-900/80">
        {suggestion?.explanation || 'This mode has nothing useful to add at the current cursor position.'}
      </p>
    </div>
  );
}