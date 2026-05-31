import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import AppShell from '../../components/AppShell';
import NavBar from '../../components/NavBar';
import Sidebar from '../../components/Sidebar';
import StudyWorkspace from '../../components/StudyWorkspace';
import { WorkspaceProvider } from '../../components/WorkspaceContext';
import { getModelProviderEnv } from '../../lib/config/env';

export default async function WorkspacePage() {
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
    <WorkspaceProvider>
      <AppShell
        nav={
          <NavBar
            modelProvider={modelProviderEnv.MODEL_PROVIDER}
            signOutAction={handleSignOut}
            userEmail={session.user.email}
            userName={session.user.name}
          />
        }
        sidebar={<Sidebar />}
      >
        <StudyWorkspace userId={session.user.id} />
      </AppShell>
    </WorkspaceProvider>
  );
}
