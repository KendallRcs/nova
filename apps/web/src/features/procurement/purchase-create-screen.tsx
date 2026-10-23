'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useDeferredValue, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';

import { problemMessage } from '@/shared/api/problem-details';
import { formatMoney } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import {
  advancesQueryRoot,
  confirmPurchase,
  listProcurementLocations,
  listSupplierAdvances,
  newOperationId,
  paymentMethodLabels,
  procurementLocationsQueryKey,
  procurementProductQueryKey,
  purchasesQueryRoot,
  searchPurchaseProducts,
  searchSuppliers,
  suppliersQueryKey,
  type PaymentMethod,
  type Product,
} from './procurement-api';
import styles from './purchase-create.module.css';

interface Line {
  product: Product;
  locationId: string;
  quantity: string;
  cost: string;
}

export function PurchaseCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [lines, setLines] = useState<Line[]>([]);
  const [applications, setApplications] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const suppliers = useQuery({ queryKey: suppliersQueryKey(''), queryFn: () => searchSuppliers() });
  const locations = useQuery({
    queryKey: procurementLocationsQueryKey,
    queryFn: listProcurementLocations,
  });
  const products = useQuery({
    queryKey: procurementProductQueryKey(deferredQuery),
    queryFn: () => searchPurchaseProducts(deferredQuery),
    enabled: deferredQuery.length > 0,
  });
  const advances = useQuery({
    queryKey: [...advancesQueryRoot, 'purchase', supplierId],
    queryFn: () => listSupplierAdvances({ supplierId, status: 'pending' }),
    enabled: supplierId.length > 0,
  });
  const totalCents = useMemo(
    () =>
      lines.reduce(
        (total, line) => total + positiveInteger(line.quantity) * parseMoney(line.cost),
        0,
      ),
    [lines],
  );
  const advanceAppliedCents =
    advances.data?.reduce((total, advance) => {
      const requested = parseMoney(applications[advance.id] ?? '');
      return total + Math.min(requested, advance.currentBalanceCents);
    }, 0) ?? 0;
  const newlyPaidCents = Math.max(0, totalCents - advanceAppliedCents);
  const invalidAdvance = advances.data?.find(
    (advance) => parseMoney(applications[advance.id] ?? '') > advance.currentBalanceCents,
  );
  const ready =
    supplierId.length > 0 &&
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.locationId.length > 0 &&
        positiveInteger(line.quantity) > 0 &&
        parseMoney(line.cost) > 0,
    ) &&
    invalidAdvance === undefined &&
    advanceAppliedCents <= totalCents;
  const save = useMutation({
    mutationFn: async () => {
      const input = {
        supplierId,
        lines: lines.map((line) => ({
          productId: line.product.id,
          destinationLocationId: line.locationId,
          quantity: positiveInteger(line.quantity),
          unitCostCents: parseMoney(line.cost),
        })),
        advanceApplications: (advances.data ?? []).flatMap((advance) => {
          const amountCents = parseMoney(applications[advance.id] ?? '');
          return amountCents > 0
            ? [{ advanceId: advance.id, expectedVersion: advance.version, amountCents }]
            : [];
        }),
        paymentMethod: newlyPaidCents > 0 ? paymentMethod : null,
      };
      const signature = JSON.stringify(input);
      if (operation.current?.signature !== signature) {
        operation.current = { signature, id: newOperationId() };
      }
      return confirmPurchase({ operationId: operation.current.id, ...input });
    },
    onSuccess(purchase) {
      operation.current = null;
      void queryClient.invalidateQueries({ queryKey: purchasesQueryRoot });
      void queryClient.invalidateQueries({ queryKey: advancesQueryRoot });
      router.push(`/purchases/${purchase.id}` as Route);
    },
  });

  function addProduct(product: Product) {
    if (lines.some((line) => line.product.id === product.id)) return;
    setLines((current) => [
      ...current,
      { product, locationId: locations.data?.[0]?.id ?? '', quantity: '1', cost: '' },
    ]);
    setQuery('');
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) save.mutate();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={() => {
            router.push('/purchases');
          }}
        >
          <Icon name="arrow" /> Volver a compras
        </button>
        <p>Nuevo ingreso</p>
        <h1>Registrar compra</h1>
        <span>Define lo recibido, su costo real y el dinero pagado ahora.</span>
      </header>
      <form className={styles.workspace} onSubmit={submit} noValidate>
        <main>
          <section className={styles.section}>
            <h2>1. Proveedor</h2>
            <select
              aria-label="Proveedor"
              value={supplierId}
              onChange={(event) => {
                setSupplierId(event.target.value);
                setApplications({});
              }}
            >
              <option value="">Selecciona un proveedor</option>
              {suppliers.data?.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </section>
          <section className={styles.section}>
            <h2>2. Productos recibidos</h2>
            <label className={styles.search}>
              <span>Buscar por código o nombre</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Escribe para buscar"
              />
            </label>
            {deferredQuery ? (
              <div className={styles.results}>
                {products.isPending ? <p>Buscando…</p> : null}
                {products.data?.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    disabled={lines.some((line) => line.product.id === product.id)}
                    onClick={() => {
                      addProduct(product);
                    }}
                  >
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.code}</small>
                    </span>
                    <b>Agregar</b>
                  </button>
                ))}
              </div>
            ) : null}
            {lines.length === 0 ? (
              <p className={styles.empty}>Busca el primer producto de esta compra.</p>
            ) : (
              <div className={styles.lines}>
                {lines.map((line, index) => (
                  <article key={line.product.id}>
                    <header>
                      <strong>{line.product.name}</strong>
                      <small>{line.product.code}</small>
                      <button
                        type="button"
                        onClick={() => {
                          setLines((current) =>
                            current.filter(({ product }) => product.id !== line.product.id),
                          );
                        }}
                      >
                        Quitar
                      </button>
                    </header>
                    <div>
                      <label>
                        <span>Ubicación de ingreso</span>
                        <select
                          value={line.locationId}
                          onChange={(event) => {
                            setLines((current) =>
                              current.map((item, position) =>
                                position === index
                                  ? { ...item, locationId: event.target.value }
                                  : item,
                              ),
                            );
                          }}
                        >
                          {locations.data?.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Cantidad</span>
                        <input
                          aria-label={`Cantidad de ${line.product.name}`}
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) => {
                            setLines((current) =>
                              current.map((item, position) =>
                                position === index
                                  ? { ...item, quantity: event.target.value }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </label>
                      <label>
                        <span>Costo por unidad</span>
                        <span className={styles.money}>
                          <b>S/</b>
                          <input
                            aria-label={`Costo de ${line.product.name}`}
                            inputMode="decimal"
                            value={line.cost}
                            onChange={(event) => {
                              setLines((current) =>
                                current.map((item, position) =>
                                  position === index ? { ...item, cost: event.target.value } : item,
                                ),
                              );
                            }}
                          />
                        </span>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className={styles.section}>
            <h2>3. Anticipos aplicados</h2>
            {!supplierId ? (
              <p className={styles.empty}>Selecciona un proveedor para ver sus anticipos.</p>
            ) : advances.data?.length ? (
              <div className={styles.advances}>
                {advances.data.map((advance) => (
                  <label key={advance.id}>
                    <span>
                      <strong>{formatMoney(advance.currentBalanceCents)} disponibles</strong>
                      <small>{advance.purpose ?? 'Sin detalle'}</small>
                    </span>
                    <span className={styles.money}>
                      <b>S/</b>
                      <input
                        aria-label={`Aplicar anticipo de ${advance.supplierName}`}
                        inputMode="decimal"
                        value={applications[advance.id] ?? ''}
                        onChange={(event) => {
                          setApplications((current) => ({
                            ...current,
                            [advance.id]: event.target.value,
                          }));
                        }}
                        placeholder="0.00"
                      />
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>Este proveedor no tiene anticipos pendientes.</p>
            )}
            {invalidAdvance ? (
              <p className={styles.error}>El importe supera el saldo de un anticipo.</p>
            ) : null}
          </section>
        </main>
        <aside className={styles.summary}>
          <p>Resumen</p>
          <h2>Compra actual</h2>
          <dl>
            <div>
              <dt>Total de compra</dt>
              <dd>{formatMoney(totalCents)}</dd>
            </div>
            <div>
              <dt>Anticipos aplicados</dt>
              <dd>{formatMoney(advanceAppliedCents)}</dd>
            </div>
            <div>
              <dt>Pagar ahora</dt>
              <dd>{formatMoney(newlyPaidCents)}</dd>
            </div>
          </dl>
          {newlyPaidCents > 0 ? (
            <label>
              <span>Método de pago</span>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as PaymentMethod);
                }}
              >
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : totalCents > 0 ? (
            <p className={styles.covered}>Los anticipos cubren todo el pago.</p>
          ) : (
            <p className={styles.pendingHint}>Agrega productos para calcular el pago.</p>
          )}
          {save.isError ? <p className={styles.error}>{problemMessage(save.error)}</p> : null}
          <button type="submit" disabled={!ready || save.isPending}>
            {save.isPending ? 'Confirmando…' : 'Confirmar compra'}
          </button>
        </aside>
      </form>
    </div>
  );
}

function parseMoney(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(\.\d{0,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : 0;
}
function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}
