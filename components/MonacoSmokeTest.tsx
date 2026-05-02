'use client';

import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-sm text-zinc-500">
      Loading Monaco editor...
    </div>
  ),
});

const smokeTestOutline = `@root: Photosynthesis
- @branch: Overview
  - Definition
  - Why it matters
- @branch: Light-dependent reactions
  - Location: thylakoid membrane
  - Inputs: light, H2O, ADP, NADP+
  - Outputs: O2, ATP, NADPH
- @branch: Calvin cycle
  - Location: stroma
  - Steps: fixation, reduction, regeneration
`;

export default function MonacoSmokeTest() {
  return (
    <section className="grid h-full gap-4">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold text-zinc-950">Study editor</h2>
        <p className="max-w-2xl text-sm leading-6 text-zinc-600">
          This Monaco mount is the starter surface for the structured study outline.
          It will evolve into the learning-first editor with inline completions and
          validation.
        </p>
      </div>

      <div className="h-[460px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <Editor
          defaultLanguage="markdown"
          defaultValue={smokeTestOutline}
          height="100%"
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
          theme="light"
        />
      </div>
    </section>
  );
}