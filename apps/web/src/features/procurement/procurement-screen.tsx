'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import { problemMessage } from '@/shared/api/problem-details';
import { formatDate, formatMoney } from '@/shared/formatters';
import { ModuleStart } from '@/shared/ui/module-start';
import { AdvanceForm, AdvanceResolutionForm, SupplierForm } from './procurement-forms';
import {
  advancesQueryKey,
  listPurchases,
  listSupplierAdvances,
  paymentMethodLabels,
  purchasesQueryKey,
  searchSuppliers,
  suppliersQueryKey,
  type PurchaseSummary,
  type Supplier,
  type SupplierAdvance,
} from './procurement-api';
import styles from './procurement.module.css';

type View = 'purchases' | 'advances' | 'suppliers';
type Composer = 'supplier' | 'advance' | null;

export function ProcurementScreen() {
  const actor = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const allowed = actor.data !== undefined && hasPermission(actor.data, 'purchases:manage');
  const [view, setView] = useState<View>('purchases');
  const [composer, setComposer] = useState<Composer>(null);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [advanceStatus, setAdvanceStatus] = useState<'all' | SupplierAdvance['status']>('pending');
  const suppliers = useQuery({
    queryKey: suppliersQueryKey(''),
    queryFn: () => searchSuppliers(),
    enabled: allowed,
  });
  const advances = useQuery({
    queryKey: advancesQueryKey(supplierFilter, advanceStatus),
    queryFn: () =>
      listSupplierAdvances({
        ...(supplierFilter ? { supplierId: supplierFilter } : {}),
        ...(advanceStatus === 'all' ? {} : { status: advanceStatus }),
      }),
    enabled: allowed,
  });
  const purchases = useInfiniteQuery({
    queryKey: purchasesQueryKey(supplierFilter),
    queryFn: ({ pageParam }) =>
      listPurchases({
        ...(supplierFilter ? { supplierId: supplierFilter } : {}),
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    enabled: allowed,
  });

  if (actor.isPending) return <ProcurementSkeleton />;
  if (!allowed) {
    return (
      <ModuleStart
        title="Compras"
        description="Esta sección está reservada para administración."
        help="Las compras cambian costos e inventario, por eso requieren permisos administrativos."
      >
        <Feedback title="No tienes acceso a compras" detail="Vuelve a Inicio para continuar." />
      </ModuleStart>
    );
  }

  const purchaseItems = purchases.data?.pages.flatMap((page) => page.items) ?? [];
  const pendingAdvanceTotal =
    advances.data?.reduce((total, advance) => total + advance.currentBalanceCents, 0) ?? 0;

  return (
    <ModuleStart
      title="Compras"
      description="Controla proveedores, anticipos e ingresos de mercadería con sus costos reales."
      help="Una compra aumenta inventario, pero no es un gasto operativo. El costo pasa al resultado cuando se vende el producto."
    >
      <section className={styles.commandPanel}>
        <div>
          <p className={styles.kicker}>Abastecimiento</p>
          <h2>Todo el ciclo del proveedor</h2>
          <p>Los anticipos aplicados no vuelven a contarse como dinero pagado.</p>
        </div>
        <div className={styles.commandActions}>
          <button
            type="button"
            onClick={() => {
              setComposer('supplier');
            }}
          >
            Nuevo proveedor
          </button>
          <button
            type="button"
            onClick={() => {
              setComposer('advance');
            }}
          >
            Registrar anticipo
          </button>
          <button type="button" disabled title="Se habilitará con el formulario de compra">
            Registrar compra
          </button>
        </div>
      </section>

      {composer === 'supplier' ? (
        <SupplierForm
          onClose={() => {
            setComposer(null);
          }}
        />
      ) : null}
      {composer === 'advance' ? (
        <AdvanceForm
          suppliers={suppliers.data ?? []}
          onClose={() => {
            setComposer(null);
          }}
          onSaved={() => {
            setComposer(null);
            setView('advances');
          }}
        />
      ) : null}

      <section className={styles.overview} aria-label="Resumen de abastecimiento">
        <div>
          <span>Compras visibles</span>
          <strong>{purchaseItems.length}</strong>
          <small>En el historial cargado</small>
        </div>
        <div data-alert={pendingAdvanceTotal > 0}>
          <span>Anticipos por resolver</span>
          <strong>{formatMoney(pendingAdvanceTotal)}</strong>
          <small>Según los filtros actuales</small>
        </div>
        <div>
          <span>Proveedores activos</span>
          <strong>{suppliers.data?.length ?? 0}</strong>
          <small>Registrados y ocasionales</small>
        </div>
      </section>

      <div className={styles.filters}>
        <nav aria-label="Sección de compras">
          {(
            [
              ['purchases', 'Compras'],
              ['advances', 'Anticipos'],
              ['suppliers', 'Proveedores'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        {view !== 'suppliers' ? (
          <label>
            <span>Proveedor</span>
            <select
              value={supplierFilter}
              onChange={(event) => {
                setSupplierFilter(event.target.value);
              }}
            >
              <option value="">Todos</option>
              {suppliers.data?.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {view === 'advances' ? (
          <label>
            <span>Estado</span>
            <select
              value={advanceStatus}
              onChange={(event) => {
                setAdvanceStatus(event.target.value as typeof advanceStatus);
              }}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="resolved">Resueltos</option>
            </select>
          </label>
        ) : null}
      </div>

      {view === 'purchases' ? (
        <PurchaseHistory
          items={purchaseItems}
          pending={purchases.isPending}
          error={purchases.isError ? purchases.error : null}
          hasMore={purchases.hasNextPage}
          loadingMore={purchases.isFetchingNextPage}
          onMore={() => {
            void purchases.fetchNextPage();
          }}
        />
      ) : null}
      {view === 'advances' ? (
        <AdvanceList
          items={advances.data ?? []}
          pending={advances.isPending}
          error={advances.isError ? advances.error : null}
        />
      ) : null}
      {view === 'suppliers' ? (
        <SupplierDirectory
          items={suppliers.data ?? []}
          pending={suppliers.isPending}
          error={suppliers.isError ? suppliers.error : null}
        />
      ) : null}
    </ModuleStart>
  );
}

function PurchaseHistory({
  items,
  pending,
  error,
  hasMore,
  loadingMore,
  onMore,
}: Readonly<{
  items: PurchaseSummary[];
  pending: boolean;
  error: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}>) {
  return (
    <section className={styles.ledger} aria-labelledby="purchase-history-title">
      <header>
        <div>
          <p className={styles.kicker}>Compras confirmadas</p>
          <h2 id="purchase-history-title">Historial económico y físico</h2>
        </div>
        <span>{items.length} operaciones</span>
      </header>
      {pending ? <RowsSkeleton /> : null}
      {error !== null ? (
        <Feedback title="No pudimos cargar las compras" detail={problemMessage(error)} />
      ) : null}
      {!pending && error === null && items.length === 0 ? (
        <Feedback
          title="Todavía no hay compras"
          detail="Registra la primera reposición para conservar costos e inventario."
        />
      ) : null}
      {items.map((purchase) => (
        <article key={purchase.id} className={styles.purchaseRow}>
          <span>
            <strong>{purchase.supplier.name}</strong>
            <small>
              {formatDate(purchase.effectiveAt)} · {purchase.confirmerUsername}
            </small>
          </span>
          <span>
            <small>Productos</small>
            <strong>
              {purchase.totalQuantity} en {purchase.lineCount}{' '}
              {purchase.lineCount === 1 ? 'línea' : 'líneas'}
            </strong>
          </span>
          <span>
            <small>Anticipos</small>
            <strong>{formatMoney(purchase.advanceAppliedCents)}</strong>
          </span>
          <span>
            <small>Total</small>
            <strong>{formatMoney(purchase.totalCents)}</strong>
          </span>
        </article>
      ))}
      {hasMore ? (
        <button className={styles.moreButton} type="button" onClick={onMore} disabled={loadingMore}>
          {loadingMore ? 'Cargando…' : 'Cargar más compras'}
        </button>
      ) : null}
    </section>
  );
}

function AdvanceList({
  items,
  pending,
  error,
}: Readonly<{ items: SupplierAdvance[]; pending: boolean; error: unknown }>) {
  const [resolving, setResolving] = useState<string | null>(null);
  return (
    <section className={styles.ledger} aria-labelledby="advance-list-title">
      <header>
        <div>
          <p className={styles.kicker}>Dinero entregado antes de comprar</p>
          <h2 id="advance-list-title">Anticipos a proveedores</h2>
        </div>
        <span>{items.length} anticipos</span>
      </header>
      {pending ? <RowsSkeleton /> : null}
      {error !== null ? (
        <Feedback title="No pudimos cargar los anticipos" detail={problemMessage(error)} />
      ) : null}
      {!pending && error === null && items.length === 0 ? (
        <Feedback
          title="No hay anticipos con estos filtros"
          detail="Cambia el estado o proveedor."
        />
      ) : null}
      {items.map((advance) => (
        <article className={styles.advanceRow} key={advance.id}>
          <div className={styles.advanceSummary}>
            <span>
              <strong>{advance.supplierName}</strong>
              <small>
                {formatDate(advance.effectiveAt)} · {paymentMethodLabels[advance.method]}
              </small>
            </span>
            <span>
              <small>Monto original</small>
              <strong>{formatMoney(advance.originalAmountCents)}</strong>
            </span>
            <span data-alert={advance.currentBalanceCents > 0}>
              <small>Saldo vigente</small>
              <strong>{formatMoney(advance.currentBalanceCents)}</strong>
            </span>
            <span className={styles.status} data-resolved={advance.status === 'resolved'}>
              {advance.status === 'pending' ? 'Pendiente' : 'Resuelto'}
            </span>
            {advance.status === 'pending' ? (
              <button
                type="button"
                onClick={() => {
                  setResolving((current) => (current === advance.id ? null : advance.id));
                }}
              >
                {resolving === advance.id ? 'Cerrar' : 'Resolver'}
              </button>
            ) : null}
          </div>
          {advance.purpose ? <p className={styles.purpose}>{advance.purpose}</p> : null}
          {resolving === advance.id ? (
            <AdvanceResolutionForm
              advance={advance}
              onDone={() => {
                setResolving(null);
              }}
            />
          ) : null}
        </article>
      ))}
    </section>
  );
}

function SupplierDirectory({
  items,
  pending,
  error,
}: Readonly<{ items: Supplier[]; pending: boolean; error: unknown }>) {
  return (
    <section className={styles.ledger} aria-labelledby="supplier-list-title">
      <header>
        <div>
          <p className={styles.kicker}>Identidades estables</p>
          <h2 id="supplier-list-title">Proveedores</h2>
        </div>
        <span>{items.length} proveedores</span>
      </header>
      {pending ? <RowsSkeleton /> : null}
      {error !== null ? (
        <Feedback title="No pudimos cargar los proveedores" detail={problemMessage(error)} />
      ) : null}
      {items.map((supplier) => (
        <article className={styles.supplierRow} key={supplier.id}>
          <span className={styles.supplierMark} aria-hidden="true">
            {supplier.name.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <strong>{supplier.name}</strong>
            <small>{supplier.kind === 'registered' ? 'Registrado' : 'Ocasional'}</small>
          </span>
          <span>
            <small>Teléfono</small>
            <strong>{supplier.phone ?? 'No registrado'}</strong>
          </span>
          <span>
            <small>Documento</small>
            <strong>{supplier.document ?? 'No registrado'}</strong>
          </span>
        </article>
      ))}
    </section>
  );
}

function Feedback({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className={styles.feedback}>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Cargando información">
      <span />
      <span />
      <span />
    </div>
  );
}

function ProcurementSkeleton() {
  return (
    <div className={styles.pageSkeleton} aria-label="Cargando compras">
      <span />
      <span />
    </div>
  );
}
