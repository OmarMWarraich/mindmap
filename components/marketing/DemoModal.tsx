'use client';

import { useEffect } from 'react';

interface DemoModalProps {
  onClose: () => void;
}

export default function DemoModal({ onClose }: DemoModalProps) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      aria-label="Product demo"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-primary-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close demo"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 14 14" width="14">
            <path d="M1 1 13 13M13 1 1 13" />
          </svg>
        </button>

        {/* Replace src with a real video or YouTube embed URL */}
        <div className="aspect-video w-full bg-primary-800 flex items-center justify-center">
          <p className="text-sm text-zinc-500">Demo video coming soon</p>
        </div>
      </div>
    </div>
  );
}
