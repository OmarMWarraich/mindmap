import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('routing invariants keep landing public and workspace protected', () => {
  const proxySource = readSource('../proxy.ts');
  const workspacePageSource = readSource('../app/workspace/page.tsx');

  assert.match(
    proxySource,
    /req\.nextUrl\.pathname !== '\/' && req\.nextUrl\.pathname !== '\/login'/,
  );
  assert.match(workspacePageSource, /redirect\('\/login'\)/);
  assert.match(workspacePageSource, /signOut\(\{ redirectTo: '\/' \}\)/);
});

test('oauth sign-in paths continue to workspace after successful login', () => {
  const loginPageSource = readSource('../app/login/page.tsx');

  assert.match(loginPageSource, /signIn\('github', \{ redirectTo: '\/workspace' \}\)/);
  assert.match(loginPageSource, /signIn\('google', \{ redirectTo: '\/workspace' \}\)/);
});

test('oauth providers never re-enable dangerous cross-provider email linking', () => {
  // Security decision (#29): an unauthenticated OAuth sign-in must not be
  // auto-linked into an existing account by email. Lock it here so it cannot be
  // silently re-enabled. See the auth.ts comment and README "Authentication".
  const authSource = readSource('../auth.ts');

  assert.doesNotMatch(authSource, /allowDangerousEmailAccountLinking\s*:/);
});

test('login page explains the duplicate-email sign-in outcome', () => {
  const loginPageSource = readSource('../app/login/page.tsx');

  assert.match(loginPageSource, /OAuthAccountNotLinked/);
  assert.match(loginPageSource, /searchParams/);
});

test('primary CTAs and brand links point to the expected destinations', () => {
  const heroSource = readSource('../components/marketing/HeroSection.tsx');
  const landingNavSource = readSource('../components/marketing/LandingNav.tsx');
  const ctaBannerSource = readSource('../components/marketing/CtaBanner.tsx');
  const navBarSource = readSource('../components/NavBar.tsx');

  assert.match(heroSource, /href="\/login"/);
  assert.match(landingNavSource, /href: '#pricing'/);
  assert.equal((landingNavSource.match(/href="\/login"/g) ?? []).length >= 2, true);
  assert.match(ctaBannerSource, /href="\/login"/);
  assert.match(navBarSource, /href="\/workspace"/);
});

test('marketing interactions remain wired for demo modal and pricing anchor', () => {
  const heroSource = readSource('../components/marketing/HeroSection.tsx');
  const pricingSource = readSource('../components/marketing/PricingSection.tsx');

  assert.match(heroSource, /const \[demoOpen, setDemoOpen\] = useState\(false\)/);
  assert.match(heroSource, /onClick=\{\(\) => setDemoOpen\(true\)\}/);
  assert.match(heroSource, /\{demoOpen && <DemoModal onClose=\{\(\) => setDemoOpen\(false\)\} \/>\}/);
  assert.match(pricingSource, /section id="pricing"/);
});

test('accent token swap is preserved across key landing and app surfaces', () => {
  const globalsSource = readSource('../app/globals.css');
  const heroSource = readSource('../components/marketing/HeroSection.tsx');
  const landingNavSource = readSource('../components/marketing/LandingNav.tsx');
  const sidebarSource = readSource('../components/Sidebar.tsx');
  const chatPanelSource = readSource('../components/ChatPanel.tsx');

  assert.match(globalsSource, /--color-accent-500: #06b6d4;/);
  assert.match(heroSource, /bg-accent-500/);
  assert.match(landingNavSource, /bg-accent-500/);
  assert.match(sidebarSource, /bg-accent-500/);
  assert.match(chatPanelSource, /bg-accent-600/);
});