function TwitterIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

type FooterLink = {
  label: string;
  href?: string;
};

type SocialLink = {
  label: string;
  href?: string;
  icon: React.ReactNode;
};

const SOCIAL_LINKS: SocialLink[] = [
  { label: 'Twitter', icon: <TwitterIcon /> },
  { label: 'GitHub', icon: <GitHubIcon /> },
];

const FOOTER_COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Changelog' },
      { label: 'Documentation' },
      { label: 'API Reference' },
      { label: 'Browser Extension' },
    ] satisfies FooterLink[],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Templates' },
      { label: 'Tutorials' },
      { label: 'Community Forum' },
      { label: 'Use Cases' },
    ] satisfies FooterLink[],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy' },
      { label: 'Terms of Service' },
      { label: 'Security' },
      { label: 'Cookies' },
    ] satisfies FooterLink[],
  },
];

function renderFooterLink(link: FooterLink) {
  if (link.href) {
    return (
      <a className="text-sm text-zinc-500 transition-colors hover:text-zinc-800" href={link.href}>
        {link.label}
      </a>
    );
  }

  return <span className="text-sm text-zinc-400">{link.label}</span>;
}

function renderSocialLink(link: SocialLink) {
  if (link.href) {
    return (
      <a aria-label={link.label} className="transition-colors hover:text-zinc-700" href={link.href}>
        {link.icon}
      </a>
    );
  }

  return (
    <span aria-label={`${link.label} coming soon`} className="cursor-default text-zinc-300" role="img">
      {link.icon}
    </span>
  );
}

export default function LandingFooter() {
  return (
    <footer className="border-t border-zinc-100 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div>
            <p className="mb-1 text-sm font-semibold text-primary-900">MindFlow AI</p>
            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              The systematic workspace for high-productivity thinkers and technical creators.
            </p>
            <div className="flex gap-3 text-zinc-400">
              {SOCIAL_LINKS.map((link) => (
                <span key={link.label}>{renderSocialLink(link)}</span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {col.title}
              </p>
              <ul className="grid gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {renderFooterLink(link)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-zinc-100 pt-6 md:flex-row">
          <p className="text-xs text-zinc-400">© 2026 MindFlow AI. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />
            All Systems Operational
          </div>
        </div>
      </div>
    </footer>
  );
}
