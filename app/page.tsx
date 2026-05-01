import MonacoSmokeTest from "../components/MonacoSmokeTest";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950 sm:px-10 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-8">
        <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Mindmap MVP
          </span>
          <div className="grid gap-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950">
              Learning-first mindmap workspace
            </h1>
            <p className="max-w-3xl text-base leading-7 text-zinc-600">
              This shell establishes the main workflow surface: a toolbar for study
              actions, a structured editor for writing, and a preview pane for the
              generated mindmap.
            </p>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-zinc-950">Toolbar area</h2>
              <p className="text-sm leading-6 text-zinc-600">
                Generate, refresh, export, and status controls will live here.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
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
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
              <MonacoSmokeTest />
            </div>

            <aside className="grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <div className="grid gap-1">
                <h2 className="text-xl font-semibold text-zinc-950">Mindmap preview</h2>
                <p className="text-sm leading-6 text-zinc-600">
                  Layout output, branch colours, and export bounds will render in this
                  panel once the deterministic generation pipeline is in place.
                </p>
              </div>

              <div className="grid min-h-[460px] place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
                <div className="grid max-w-sm gap-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                    <span className="text-2xl">◎</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-950">Preview placeholder</h3>
                  <p className="text-sm leading-6 text-zinc-600">
                    The editor is live on the left. The generated radial map will appear
                    here after the parser, layout engine, and SVG renderer are connected.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
