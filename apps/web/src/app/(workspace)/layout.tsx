import type { ReactNode } from 'react';

import { WorkspaceGate } from '@/features/auth/workspace-gate';

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <WorkspaceGate>{children}</WorkspaceGate>;
}
