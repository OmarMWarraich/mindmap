import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import AppShell from '../components/AppShell';
import NavBar from '../components/NavBar';
import StudyWorkspace from '../components/StudyWorkspace';
import { getModelProviderEnv } from '../lib/config/env';

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const modelProviderEnv = getModelProviderEnv();

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    // sidebar={null} — will be replaced by <Sidebar> in Phase D.
    <AppShell
      nav={
        <NavBar
          modelProvider={modelProviderEnv.MODEL_PROVIDER}
          signOutAction={handleSignOut}
          userEmail={session.user.email}
          userName={session.user.name}
        />
      }
      sidebar={null}
    >
      <StudyWorkspace userId={session.user.id} />
    </AppShell>
  );
}
