'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  closeSession,
  getCurrentActor,
  hasPermission,
  sessionQueryKey,
} from '@/features/auth/auth-api';
import { ModuleStart } from '@/shared/ui/module-start';
import styles from './more.module.css';

const adminAreas = [
  ['Mercadería', 'Catálogo, compras y anticipos', '/purchases'],
  ['Finanzas', 'Gastos y reportes', null],
  ['Administración', 'Usuarios y carga inicial', null],
] as const;

export function MoreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: actor } = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor });
  const logout = useMutation({
    mutationFn: closeSession,
    onSuccess() {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace('/login');
    },
  });

  if (actor === undefined) return null;
  const administrator = hasPermission(actor, 'users:manage');

  return (
    <ModuleStart
      title="Más"
      description="Encuentra las funciones menos frecuentes y administra tu acceso."
      help="Las opciones se adaptan a los permisos de tu cuenta. Las acciones administrativas no se muestran al empleado."
    >
      <div className={styles.sections}>
        {administrator ? (
          <section aria-labelledby="admin-areas">
            <p className={styles.label}>Solo administrador</p>
            <h2 id="admin-areas">Gestión del negocio</h2>
            <div className={styles.areaList}>
              {adminAreas.map(([title, detail, href]) =>
                href === null ? (
                  <div key={title}>
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </div>
                ) : (
                  <Link key={title} href={href as Route}>
                    <span>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </span>
                    <b aria-hidden="true">Abrir →</b>
                  </Link>
                ),
              )}
            </div>
          </section>
        ) : null}
        <section aria-labelledby="account-title">
          <p className={styles.label}>Mi cuenta</p>
          <h2 id="account-title">{actor.username}</h2>
          <p>{administrator ? 'Administrador' : 'Empleado'}</p>
          <button
            type="button"
            onClick={() => {
              logout.mutate();
            }}
            disabled={logout.isPending}
          >
            {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </section>
      </div>
    </ModuleStart>
  );
}
