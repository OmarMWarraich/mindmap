import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import AppShell from '../components/AppShell';
import StudyWorkspace from '../components/StudyWorkspace';
import { getModelProviderEnv } from '../lib/config/env';

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const modelProviderEnv = getModelProviderEnv();

  // Temporary nav placeholder — will be replaced by <NavBar> in Phase C.
  const nav = (
    <div className="flex h-full items-center justify-between px-4">
      <span className="text-sm font-semibold tracking-tight text-primary-800">
        MindFlow
      </span>
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {modelProviderEnv.MODEL_PROVIDER}
        </span>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-700"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    // sidebar={null} — will be replaced by <Sidebar> in Phase D.
    <AppShell nav={nav} sidebar={null}>
      <StudyWorkspace userId={session.user.id} />
    </AppShell>
  );
}
