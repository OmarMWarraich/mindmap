import MonacoSmokeTest from "../components/MonacoSmokeTest";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950 sm:px-10 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-10">
        <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Mindmap MVP
          </span>
          <div className="grid gap-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950">
              Monaco is installed and ready for the study editor workflow.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-zinc-600">
              This smoke test mounts a client-only Monaco editor inside the Next.js App
              Router to verify the core editor dependency works before the full learning
              assistant UI is built.
            </p>
          </div>
        </section>

        <MonacoSmokeTest />
      </div>
    </main>
  );
}
