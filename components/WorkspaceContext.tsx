'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type ActivePanel = 'notes' | 'history' | 'chat' | 'guides';

interface WorkspaceContextValue {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  activePanel: 'notes',
  setActivePanel: () => {},
  projectName: 'Untitled Project',
  setProjectName: () => {},
  previewOpen: false,
  setPreviewOpen: () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<ActivePanel>('notes');
  const [projectName, setProjectName] = useState('Untitled Project');
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <WorkspaceContext.Provider
      value={{ activePanel, setActivePanel, projectName, setProjectName, previewOpen, setPreviewOpen }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
