'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import { Icon } from '@/shared/ui/icons';
import styles from './home.module.css';

export function HomeScreen() {
  const { data: actor } = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor });
  if (actor === undefined) return null;

  const administrator = hasPermission(actor, 'users:manage');
  const formattedDate = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Lima',
  }).format(new Date());

  return (
    <div className={styles.home}>
      <header className={styles.heading}>
        <div>
          <p className={styles.date}>{capitalize(formattedDate)}</p>
          <h1>Hola, {actor.username}</h1>
          <p>
            {administrator
              ? 'Revisa lo importante y entra rápidamente a cada operación.'
              : 'Consulta productos y registra tus operaciones sin perder el contexto.'}
          </p>
        </div>
        <details className={styles.help}>
          <summary>
            <Icon name="help" /> Cómo funciona
          </summary>
          <div>
            <strong>Tu inicio se adapta a tus permisos.</strong>
            <p>
              Las acciones frecuentes aparecen primero y cada movimiento queda vinculado a tu
              cuenta.
            </p>
          </div>
        </details>
      </header>

      <section className={styles.primaryAction} aria-labelledby="quick-title">
        <div>
          <p className={styles.sectionLabel}>Acción frecuente</p>
          <h2 id="quick-title">Atiende una venta desde aquí</h2>
          <p>Podrás agregar productos, acordar el pago y revisar todo antes de confirmar.</p>
        </div>
        <Link href="/sales">
          Ir a Ventas <Icon name="arrow" />
        </Link>
      </section>

      <div className={styles.workGrid}>
        <section className={styles.searchArea} aria-labelledby="search-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>Consulta rápida</p>
              <h2 id="search-title">¿Qué producto buscas?</h2>
            </div>
            <Link href="/inventory">Abrir inventario</Link>
          </div>
          <Link className={styles.searchLink} href="/inventory">
            <Icon name="search" />
            <span>Buscar por código o nombre</span>
            <Icon name="arrow" />
          </Link>
          <p className={styles.contextNote}>
            El empleado ve precios de venta y stock; los costos siguen protegidos.
          </p>
        </section>

        <section className={styles.nextActions} aria-labelledby="next-title">
          <p className={styles.sectionLabel}>Continuar el trabajo</p>
          <h2 id="next-title">Accesos directos</h2>
          <nav aria-label="Accesos directos">
            <Link href="/sales">
              <span className={styles.actionIcon} aria-hidden="true">
                V
              </span>
              <span>
                <strong>Ventas</strong>
                <small>Revisar ventas y pagos</small>
              </span>
              <Icon name="arrow" />
            </Link>
            <Link href="/customers">
              <span className={styles.actionIcon} aria-hidden="true">
                C
              </span>
              <span>
                <strong>Clientes</strong>
                <small>Consultar cuentas y saldos</small>
              </span>
              <Icon name="arrow" />
            </Link>
            {administrator ? (
              <Link href="/more">
                <span className={styles.actionIcon} aria-hidden="true">
                  A
                </span>
                <span>
                  <strong>Administración</strong>
                  <small>Compras, gastos y usuarios</small>
                </span>
                <Icon name="arrow" />
              </Link>
            ) : null}
          </nav>
        </section>
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toLocaleUpperCase('es-PE')}${value.slice(1)}`;
}
