'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { AppShell } from '@/shared/ui/app-shell';
import { problemMessage } from '@/shared/api/problem-details';
import { getCurrentActor, isUnauthenticated, sessionQueryKey } from './auth-api';
import styles from './auth.module.css';

export function WorkspaceGate({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });

  useEffect(() => {
    if (session.error !== null && isUnauthenticated(session.error)) router.replace('/login');
    if (session.data?.requiresPasswordChange) router.replace('/password');
  }, [router, session.data, session.error]);

  if (session.data !== undefined && !session.data.requiresPasswordChange) {
    return <AppShell actor={session.data}>{children}</AppShell>;
  }

  if (session.error !== null && !isUnauthenticated(session.error)) {
    return (
      <main className={styles.entryState}>
        <h1>No pudimos cargar tu espacio</h1>
        <p>{problemMessage(session.error)}</p>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => {
            void session.refetch();
          }}
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className={styles.entryState} aria-live="polite">
      <div className={styles.loadingLine} aria-hidden="true" />
      <p>Comprobando tu sesión…</p>
    </main>
  );
}
