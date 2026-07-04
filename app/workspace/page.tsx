import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import AppShell from '../../components/AppShell';
import NavBar from '../../components/NavBar';
import Sidebar from '../../components/Sidebar';
import StudyWorkspace from '../../components/StudyWorkspace';
import { WorkspaceProvider } from '../../components/WorkspaceContext';
import { listConfiguredProviders } from '../../lib/model/availability';

export default async function WorkspacePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const configuredProviders = listConfiguredProviders();

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <WorkspaceProvider>
      <AppShell
        nav={
          <NavBar
            modelProviders={configuredProviders}
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
