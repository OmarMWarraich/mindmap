export default function PricingSection() {
  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary-900">Pricing</h2>
        <p className="mt-4 text-base text-zinc-500">
          Simple, transparent pricing is on the way.
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-5 py-2.5 text-sm text-zinc-500">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-400" />
          Coming soon — join the waitlist for early access
        </div>
      </div>
    </section>
  );
}
