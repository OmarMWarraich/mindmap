import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';

export const metadata = {
  title: 'Sign in — MindFlow AI',
};

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

// Auth.js redirects sign-in failures to pages.signIn (this page) with ?error=<code>.
// Map the codes we care about to a human message; the duplicate-email case
// (OAuthAccountNotLinked) is the deliberate result of disabling cross-provider
// email linking — see auth.ts and README "Authentication".
function signInErrorMessage(error: string | undefined): string | null {
  switch (error) {
    case undefined:
      return null;
    case 'OAuthAccountNotLinked':
      return 'An account with this email already exists. Sign in with the provider you used the first time (GitHub or Google) — for security, we never link providers by email automatically.';
    case 'AccessDenied':
      return 'Access was denied. Please try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const session = await auth();

  if (session?.user?.id) {
    redirect('/workspace');
  }

  const { error } = await searchParams;
  const errorMessage = signInErrorMessage(Array.isArray(error) ? error[0] : error);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-12">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 bg-linear-to-b from-accent-50 via-white to-white" />
      <div aria-hidden="true" className="absolute left-1/2 top-28 h-56 w-56 -translate-x-1/2 rounded-full bg-accent-100/70 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link className="inline-flex items-center gap-2 text-primary-800" href="/">
            <MindFlowIcon />
            <span className="text-sm font-semibold tracking-tight">MindFlow AI</span>
          </Link>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(8,15,32,0.12)]">
          <div className="border-b border-zinc-100 bg-primary-900 px-8 py-5 text-white">
            <div className="mb-3 flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="grid gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm text-white/70">
                Continue to your MindFlow AI workspace.
              </p>
            </div>
          </div>

          <div className="grid gap-6 px-8 py-8">
            {errorMessage ? (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : null}

            <p className="text-sm leading-6 text-zinc-500">
              Use a verified GitHub or Google account. Successful OAuth sign-in continues directly to your workspace.
            </p>

            <div className="grid gap-3">
              <form
                action={async () => {
                  'use server';
                  await signIn('github', { redirectTo: '/workspace' });
                }}
              >
                <button
                  className="w-full rounded-xl bg-primary-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900"
                  type="submit"
                >
                  Continue with GitHub
                </button>
              </form>

              <form
                action={async () => {
                  'use server';
                  await signIn('google', { redirectTo: '/workspace' });
                }}
              >
                <button
                  className="w-full rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:border-accent-200 hover:bg-accent-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                  type="submit"
                >
                  Continue with Google
                </button>
              </form>
            </div>

            <p className="text-center text-xs text-zinc-400">
              By continuing, you return to the app shell at /workspace after successful authentication.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
