'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChangeEvent } from 'react';

import { problemMessage } from '@/shared/api/problem-details';
import { formatDate, formatMoney } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import { ModuleStart } from '@/shared/ui/module-start';
import {
  deliveryLabels,
  lifecycleLabels,
  listSales,
  paymentLabels,
  saleReference,
  salesQueryKey,
  type SaleActivity,
  type SaleDebtFilter,
  type SaleFilters,
  type SaleLifecycle,
} from './sales-api';
import styles from './sales.module.css';

const lifecycleOptions: readonly { value: '' | SaleLifecycle; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borradores' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'finalized', label: 'Finalizadas' },
  { value: 'cancelled', label: 'Canceladas' },
];
const debtOptions: readonly { value: SaleDebtFilter; label: string }[] = [
  { value: 'all', label: 'Cualquier pago' },
  { value: 'pending', label: 'Con saldo pendiente' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'paid', label: 'Pagadas' },
];

export function SalesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lifecycle = readLifecycle(searchParams.get('estado'));
  const debt = readDebt(searchParams.get('deuda'));
  const filters: SaleFilters = { ...(lifecycle === undefined ? {} : { lifecycle }), debt };
  const sales = useInfiniteQuery({
    queryKey: salesQueryKey(filters),
    queryFn: ({ pageParam }) => listSales(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
  });
  const items = sales.data?.pages.flatMap((page) => page.items) ?? [];

  function updateFilter(name: 'estado' | 'deuda', event: ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams.toString());
    const value = event.target.value;
    if (value === '' || (name === 'deuda' && value === 'all')) next.delete(name);
    else next.set(name, value);
    const query = next.toString();
    router.replace(query ? `/sales?${query}` : '/sales');
  }

  return (
    <ModuleStart
      title="Ventas"
      description="Sigue cada acuerdo desde el registro hasta el último pago y entrega."
      help="Pago y entrega avanzan por separado. Una venta puede estar pagada y todavía tener productos reservados, o estar entregada y conservar saldo."
    >
      <div className={styles.pageActions}>
        <Link className={styles.primaryAction} href="/sales/new">
          Registrar venta
        </Link>
      </div>
      <section className={styles.controlBar} aria-labelledby="sales-filter-title">
        <div>
          <p className={styles.kicker}>Seguimiento</p>
          <h2 id="sales-filter-title">Encuentra la venta por su situación</h2>
        </div>
        <div className={styles.filters}>
          <label>
            <span>Estado de venta</span>
            <select
              value={lifecycle ?? ''}
              onChange={(event) => {
                updateFilter('estado', event);
              }}
            >
              {lifecycleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Situación de pago</span>
            <select
              value={debt}
              onChange={(event) => {
                updateFilter('deuda', event);
              }}
            >
              {debtOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.salesPanel} aria-labelledby="sales-list-title" aria-live="polite">
        <header className={styles.listHeading}>
          <div>
            <p className={styles.kicker}>Actividad</p>
            <h2 id="sales-list-title">{listTitle(lifecycle, debt)}</h2>
          </div>
          {!sales.isPending && !sales.isError ? (
            <span>
              {items.length} {items.length === 1 ? 'venta' : 'ventas'}
            </span>
          ) : null}
        </header>
        {sales.isPending ? <SaleListSkeleton /> : null}
        {sales.isError ? (
          <Feedback
            title="No pudimos cargar las ventas"
            detail={problemMessage(sales.error)}
            action="Intentar nuevamente"
            onAction={() => {
              void sales.refetch();
            }}
          />
        ) : null}
        {!sales.isPending && !sales.isError && items.length === 0 ? (
          <Feedback
            title="No hay ventas en esta vista"
            detail="Cambia los filtros para revisar otras operaciones."
            action="Ver todas"
            onAction={() => {
              router.replace('/sales');
            }}
          />
        ) : null}
        {items.length ? (
          <div className={styles.saleList}>
            {items.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </div>
        ) : null}
        {sales.hasNextPage ? (
          <button
            className={styles.moreButton}
            type="button"
            disabled={sales.isFetchingNextPage}
            onClick={() => {
              void sales.fetchNextPage();
            }}
          >
            {sales.isFetchingNextPage ? 'Cargando…' : 'Cargar más ventas'}
          </button>
        ) : null}
      </section>
    </ModuleStart>
  );
}

function SaleRow({ sale }: Readonly<{ sale: SaleActivity }>) {
  const paidPercent =
    sale.currentTotalCents <= 0
      ? 100
      : Math.min(100, Math.round((sale.paidCents / sale.currentTotalCents) * 100));
  return (
    <Link className={styles.saleRow} href={`/sales/${sale.id}` as Route}>
      <span className={styles.saleMain}>
        <span className={styles.reference}>V-{saleReference(sale.id)}</span>
        <strong>{sale.customer?.name ?? 'Venta sin cliente'}</strong>
        <small>
          {formatDate(sale.confirmedAt ?? sale.createdAt)} · por {sale.creatorUsername}
        </small>
      </span>
      <span className={styles.stateGroup}>
        <span className={styles.lifecycle} data-state={sale.lifecycle}>
          {lifecycleLabels[sale.lifecycle]}
        </span>
        {sale.overdue ? <span className={styles.overdue}>Pago atrasado</span> : null}
        <small>{deliveryLabels[sale.deliverySituation]}</small>
      </span>
      <span className={styles.collection}>
        <span>
          <small>{paymentLabels[sale.paymentSituation]}</small>
          <strong>
            {formatMoney(sale.paidCents)} de {formatMoney(sale.currentTotalCents)}
          </strong>
        </span>
        <span className={styles.paymentTrack} aria-label={`${String(paidPercent)}% cobrado`}>
          <span style={{ width: `${String(paidPercent)}%` }} />
        </span>
      </span>
      <span className={styles.balance} data-settled={sale.balanceCents === 0}>
        <small>Saldo</small>
        <strong>{formatMoney(sale.balanceCents)}</strong>
      </span>
      <span className={styles.rowArrow} aria-hidden="true">
        <Icon name="arrow" />
      </span>
    </Link>
  );
}

function Feedback({
  title,
  detail,
  action,
  onAction,
}: Readonly<{ title: string; detail: string; action: string; onAction: () => void }>) {
  return (
    <div className={styles.feedback}>
      <strong>{title}</strong>
      <p>{detail}</p>
      <button type="button" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function SaleListSkeleton() {
  return (
    <div className={styles.skeletonList} aria-label="Cargando ventas">
      {[0, 1, 2].map((item) => (
        <div className={styles.skeletonRow} key={item}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function readLifecycle(value: string | null): SaleLifecycle | undefined {
  return value === 'draft' ||
    value === 'confirmed' ||
    value === 'finalized' ||
    value === 'cancelled'
    ? value
    : undefined;
}
function readDebt(value: string | null): SaleDebtFilter {
  return value === 'pending' || value === 'paid' || value === 'overdue' ? value : 'all';
}
function listTitle(lifecycle: SaleLifecycle | undefined, debt: SaleDebtFilter): string {
  if (debt === 'overdue') return 'Ventas con pago atrasado';
  if (debt === 'pending') return 'Ventas con saldo pendiente';
  if (debt === 'paid') return 'Ventas pagadas';
  return lifecycle === undefined
    ? 'Ventas recientes'
    : (lifecycleOptions.find((option) => option.value === lifecycle)?.label ?? 'Ventas recientes');
}
