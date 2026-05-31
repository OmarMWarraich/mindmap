function MonacoIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function RadialIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <line x1="12" x2="12" y1="7" y2="10" />
      <line x1="17" x2="14" y1="12" y2="12" />
      <line x1="12" x2="12" y1="17" y2="14" />
      <line x1="7" x2="10" y1="12" y2="12" />
    </svg>
  );
}

function ScalingIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      <path d="M4 6h16M4 10h10M4 14h7M4 18h4" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

export default function FeaturesGrid() {
  return (
    <section id="features" className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="mb-12 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary-900">
              Precision-Engineered for Synthesis
            </h2>
            <p className="mt-2 max-w-lg text-base text-zinc-500">
              Beyond simple diagrams. MindFlow AI is a high-productivity workspace designed for
              technical depth and architectural clarity.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Monaco card — tall with code snippet */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <MonacoIcon />
              </div>
              <h3 className="text-base font-semibold text-primary-900">Monaco-Powered DSL Editor</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Edit your mindmaps like code. Full syntax highlighting, auto-complete, and semantic
                linting for your thought architecture.
              </p>
            </div>
            {/* Code snippet */}
            <div className="flex-1 bg-primary-900 p-5 font-mono text-xs leading-6">
              <div aria-hidden="true" className="mb-3 flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <pre className="text-white/80" aria-label="DSL code example">
                <span className="text-accent-400">@root</span>
                {': '}
                <span className="text-tertiary-300">Project Alpha</span>
                {'\n'}
                {'- '}
                <span className="text-accent-400">@branch</span>
                {': '}
                <span className="text-white/70">Research</span>
                {'\n'}
                {'  - '}
                <span className="text-tertiary-300">Literature Review</span>
                {'\n'}
                {'  - '}
                <span className="text-tertiary-300">Data Collection</span>
                {'\n'}
                {'- '}
                <span className="text-accent-400">@branch</span>
                {': '}
                <span className="text-white/70">Synthesis</span>
                {'\n'}
                {'  - '}
                <span className="text-tertiary-300">Final Draft</span>
              </pre>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <RadialIcon />
              </div>
              <h3 className="text-base font-semibold text-primary-900">Interactive Radial Mindmaps</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Smooth 60fps canvas performance with organic radial layouts that scale to thousands
                of nodes without lag.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <ScalingIcon />
              </div>
              <h3 className="text-base font-semibold text-primary-900">Expert Scaling</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Adjust visual density based on logical importance.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <ExportIcon />
              </div>
              <h3 className="text-base font-semibold text-primary-900">High-Res Export</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Lossless PNG, SVG, and PDF exports for presentations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
