'use client';

import Link from 'next/link';
import { useState } from 'react';

import DemoModal from './DemoModal';

function PlayIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 20 20" width="16">
      <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84z" />
    </svg>
  );
}

export default function HeroSection() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start">

          {/* Left column */}
          <div className="flex max-w-xl flex-col gap-6 lg:pt-10">
            {/* Badge */}
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1">
              <span aria-hidden="true" className="text-accent-500">✦</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-600">
                AI-Powered Synthesis
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-primary-900 lg:text-6xl">
              From Notes to{' '}
              <span className="text-accent-500">Mindmaps</span>
              , Powered by AI
            </h1>

            {/* Sub-copy */}
            <p className="text-lg leading-relaxed text-zinc-500">
              Convert meeting transcripts, research notes, and unstructured ideas into
              interactive, exportable mindmaps instantly. Stop documenting, start mapping.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 active:bg-accent-700"
                href="/login"
              >
                Start Mapping for Free
              </Link>
              <button
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                onClick={() => setDemoOpen(true)}
                type="button"
              >
                <PlayIcon />
                Watch Demo
              </button>
            </div>
          </div>

          {/* Right column — workspace mockup */}
          <div className="relative w-full max-w-2xl">
            <div aria-hidden="true" className="absolute -inset-4 rounded-3xl bg-accent-100/40 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-primary-900 shadow-2xl">
              {/* Titlebar */}
              <div className="flex items-center gap-1.5 border-b border-white/10 bg-primary-800 px-4 py-3">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-white/40">MindFlow AI — Workspace</span>
              </div>
              {/* Mock content */}
              <div className="flex h-80">
                <div className="w-44 shrink-0 border-r border-white/10 bg-primary-800 p-3">
                  <div className="mb-3 h-6 w-28 rounded bg-white/10" />
                  <div className="mb-1.5 h-8 w-full rounded bg-accent-500/20" />
                  <div className="mb-1.5 h-7 w-full rounded bg-white/5" />
                  <div className="mb-1.5 h-7 w-full rounded bg-white/5" />
                  <div className="h-7 w-full rounded bg-white/5" />
                </div>
                <div className="flex-1 p-4">
                  <div className="mb-3 flex gap-2">
                    <div className="h-5 w-20 rounded bg-white/10" />
                    <div className="h-5 w-14 rounded bg-white/5" />
                  </div>
                  <div className="mb-2 h-3 w-3/4 rounded bg-white/10" />
                  <div className="mb-2 h-3 w-1/2 rounded bg-white/10" />
                  <div className="mb-4 h-3 w-2/3 rounded bg-white/10" />
                  <div className="flex gap-2">
                    <div className="h-20 w-24 rounded-lg bg-accent-500/20" />
                    <div className="h-20 flex-1 rounded-lg bg-white/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </section>
  );
}
