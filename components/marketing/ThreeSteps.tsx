function NotesIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </svg>
  );
}

function DSLIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="24">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function VisualizeIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="24">
      <rect height="6" rx="1" width="6" x="3" y="3" />
      <rect height="6" rx="1" width="6" x="15" y="3" />
      <rect height="6" rx="1" width="6" x="3" y="15" />
      <rect height="6" rx="1" width="6" x="15" y="15" />
    </svg>
  );
}

const STEPS = [
  {
    number: '1',
    icon: <NotesIcon />,
    title: 'Input Notes',
    description:
      'Paste raw text. Our model excels at parsing unstructured data, whether it’s meeting notes, research, or brainstorming sessions.',
  },
  {
    number: '2',
    icon: <DSLIcon />,
    title: 'AI Generates DSL',
    description:
      'Our model identifies hierarchies and relationships, generating a clean Domain Specific Language map.',
  },
  {
    number: '3',
    icon: <VisualizeIcon />,
    title: 'Visualize & Tune',
    description:
      'Instantly render the mindmap. Refine nodes manually or use Expert Scaling to adjust logical depth.',
  },
];

export default function ThreeSteps() {
  return (
    <section id="how-it-works" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-900">
            Three Steps to Clarity
          </h2>
          <p className="mt-3 text-base text-zinc-500">
            Our engine does the heavy lifting so you can focus on the insights.
          </p>
        </div>

        <div className="relative grid gap-12 md:grid-cols-3 md:gap-0">
          {/* Horizontal connector line */}
          <div aria-hidden="true" className="absolute left-0 right-0 top-8 hidden h-px bg-zinc-100 md:block" />
          {STEPS.map((step) => (
            <div className="flex flex-col items-center px-8 text-center" key={step.number}>
              <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-100 bg-white text-accent-500 shadow-sm">
                {step.icon}
              </div>
              <h3 className="mb-3 text-base font-semibold text-primary-900">
                {step.number}. {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
