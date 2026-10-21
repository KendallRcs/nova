'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { closeSession, hasPermission, sessionQueryKey, type Actor } from '@/features/auth/auth-api';
import { Icon, type IconName } from './icons';
import styles from './app-shell.module.css';

const primaryNavigation = [
  { href: '/home', label: 'Inicio', icon: 'home' },
  { href: '/sales', label: 'Ventas', icon: 'sales' },
  { href: '/inventory', label: 'Inventario', icon: 'inventory' },
  { href: '/customers', label: 'Clientes', icon: 'customers' },
  { href: '/more', label: 'Más', icon: 'more' },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

export function AppShell({ actor, children }: Readonly<{ actor: Actor; children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: closeSession,
    onSuccess() {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace('/login');
    },
  });
  const administrator = hasPermission(actor, 'users:manage');

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/home" aria-label="Nova, ir al inicio">
          <span aria-hidden="true">N</span>
          Nova
        </Link>
        <nav className={styles.desktopNav} aria-label="Navegación principal">
          {primaryNavigation.map((item) => (
            <NavigationLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        {administrator ? (
          <div className={styles.adminGroup}>
            <p>Administración</p>
            <Link href="/more">Compras, gastos, reportes y usuarios</Link>
          </div>
        ) : null}
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">
            {actor.username.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{actor.username}</strong>
            <small>{administrator ? 'Administrador' : 'Empleado'}</small>
          </div>
          <button
            type="button"
            onClick={() => {
              logout.mutate();
            }}
            disabled={logout.isPending}
          >
            {logout.isPending ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link className={styles.brand} href="/home" aria-label="Nova, ir al inicio">
          <span aria-hidden="true">N</span>
          Nova
        </Link>
        <span className={styles.mobileUser}>{actor.username}</span>
      </header>

      <main className={styles.content} id="main-content">
        {children}
      </main>

      <nav className={styles.mobileNav} aria-label="Navegación principal">
        {primaryNavigation.map((item) => (
          <NavigationLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </div>
  );
}

function NavigationLink({
  item,
  pathname,
}: Readonly<{
  item: (typeof primaryNavigation)[number];
  pathname: string;
}>) {
  const active =
    pathname === item.href || (item.href !== '/home' && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      className={active ? styles.activeLink : undefined}
      href={item.href}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}
