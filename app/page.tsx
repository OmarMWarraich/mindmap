import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import StudyWorkspace from '../components/StudyWorkspace';
import { getModelProviderEnv } from '../lib/config/env';

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const modelProviderEnv = getModelProviderEnv();

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950 sm:px-10 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-8">
        <section className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              Mindmap MVP
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              {`Model provider ready: ${modelProviderEnv.MODEL_PROVIDER}`}
            </span>
            <form
              className="ml-auto"
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="grid gap-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950">
              Learning-first mindmap workspace
            </h1>
            <p className="max-w-3xl text-base leading-7 text-zinc-600">
              This shell establishes the main workflow surface: a toolbar for study
              actions, a structured editor for writing, and a preview pane for the
              generated mindmap.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-zinc-500">
              Environment variables are validated on the server during render so model
              misconfiguration fails fast before AI features are wired in.
            </p>
          </div>
        </section>
        <StudyWorkspace userId={session.user.id} />
      </div>
    </main>
  );
}
