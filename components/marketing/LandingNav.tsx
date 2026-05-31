import Link from 'next/link';

function MindFlowIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
      <circle cx="10" cy="10" fill="currentColor" r="2.8" />
      <circle cx="3.5" cy="4.5" fill="currentColor" opacity="0.65" r="1.9" />
      <circle cx="16.5" cy="4.5" fill="currentColor" opacity="0.65" r="1.9" />
      <circle cx="3.5" cy="15.5" fill="currentColor" opacity="0.65" r="1.9" />
      <circle cx="16.5" cy="15.5" fill="currentColor" opacity="0.65" r="1.9" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="7.4" x2="5.0" y1="8.4" y2="6.1" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="12.6" x2="15.0" y1="8.4" y2="6.1" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="7.4" x2="5.0" y1="11.6" y2="13.9" />
      <line opacity="0.45" stroke="currentColor" strokeWidth="1.3" x1="12.6" x2="15.0" y1="11.6" y2="13.9" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: 'Features',    href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing',     href: '#pricing' },
  { label: 'Community',   href: '#community' },
];

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Brand */}
        <Link className="flex items-center gap-2 text-primary-800" href="/">
          <MindFlowIcon />
          <span className="text-sm font-semibold tracking-tight">MindFlow AI</span>
        </Link>

        {/* Nav links */}
        <nav aria-label="Marketing navigation" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              className="text-sm text-zinc-500 transition-colors hover:text-accent-700"
              href={link.href}
              key={link.label}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Auth CTAs */}
        <div className="flex items-center gap-3">
          <Link
            className="hidden text-sm font-medium text-zinc-600 transition-colors hover:text-accent-700 md:block"
            href="/login"
          >
            Login
          </Link>
          <Link
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            href="/login"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
