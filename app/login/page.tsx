import { signIn } from '@/auth';

export const metadata = {
  title: 'Sign in — MindFlow AI',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Sign in</h1>
          <p className="text-sm text-zinc-500">
            Continue to your MindFlow AI workspace.
          </p>
        </div>

        <div className="grid gap-3">
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: '/' });
            }}
          >
            <button
              className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              type="submit"
            >
              Continue with GitHub
            </button>
          </form>

          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <button
              className="w-full rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              type="submit"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
