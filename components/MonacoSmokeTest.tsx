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
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold text-zinc-950">Monaco smoke test</h2>
        <p className="max-w-2xl text-sm leading-6 text-zinc-600">
          This is a client-only editor mount to verify Monaco loads correctly in the
          App Router before the full study editor is built.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <Editor
          defaultLanguage="markdown"
          defaultValue={smokeTestOutline}
          height="420px"
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