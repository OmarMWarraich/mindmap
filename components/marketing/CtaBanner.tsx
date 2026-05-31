import Link from 'next/link';

export default function CtaBanner() {
  return (
    <section className="bg-zinc-50 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="overflow-hidden rounded-3xl bg-primary-900 px-8 py-16 text-center md:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Ready to organize your thoughts?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400">
            Join 50,000+ power users who have turned their chaotic notes into structured
            knowledge maps with MindFlow AI.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              className="rounded-xl bg-accent-500 px-7 py-3.5 text-sm font-semibold text-white shadow transition-colors hover:bg-accent-600"
              href="/login"
            >
              Get Started for Free
            </Link>
            <a
              className="rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              href="#features"
            >
              Schedule Team Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
