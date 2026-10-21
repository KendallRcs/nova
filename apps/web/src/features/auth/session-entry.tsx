'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { getCurrentActor, isUnauthenticated, sessionQueryKey } from './auth-api';
import styles from './auth.module.css';

export function SessionEntry() {
  const router = useRouter();
  const session = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });

  useEffect(() => {
    if (session.data !== undefined) {
      router.replace(session.data.requiresPasswordChange ? '/password' : '/home');
    } else if (session.error !== null && isUnauthenticated(session.error)) {
      router.replace('/login');
    }
  }, [router, session.data, session.error]);

  if (session.error !== null && !isUnauthenticated(session.error)) {
    return (
      <main className={styles.entryState}>
        <Brand />
        <h1>No pudimos abrir Nova</h1>
        <p>Revisa que la API esté disponible y vuelve a intentarlo.</p>
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
      <Brand />
      <div className={styles.loadingLine} aria-hidden="true" />
      <p>Preparando tu espacio de trabajo…</p>
    </main>
  );
}

export function Brand() {
  return (
    <div className={styles.brand} aria-label="Nova">
      <span className={styles.brandMark} aria-hidden="true">
        N
      </span>
      <span>Nova</span>
    </div>
  );
}
