'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useRef, useState, type SyntheticEvent } from 'react';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import {
  availableStock,
  productCatalogQueryKey,
  searchProducts,
  type Product,
} from '@/features/inventory/inventory-api';
import { problemMessage } from '@/shared/api/problem-details';
import { formatMoney } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import {
  confirmSale,
  createSaleDraft,
  customerSearchQueryKey,
  newOperationId,
  registerCustomer,
  searchCustomers,
  updateSaleDraft,
  type Customer,
  type DraftInput,
  type PaymentMethod,
  type SaleDraft,
} from './sale-create-api';
import { paymentMethodLabels, salesQueryRoot } from './sales-api';
import styles from './sale-create.module.css';

type PaymentMode = 'full' | 'partial' | 'none';

interface SaleLine {
  key: string;
  product: Product;
  locationId: string;
  deliveryQuantity: number;
  reservationQuantity: number;
  priceSoles: string;
  exceptionReason: string;
}

interface SavedDraft {
  draft: SaleDraft;
  signature: string;
  operationId: string;
}

export function SaleCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const lineCounter = useRef(0);
  const savedDraft = useRef<SavedDraft | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const deferredProductQuery = useDeferredValue(productQuery.trim());
  const [customerQuery, setCustomerQuery] = useState('');
  const deferredCustomerQuery = useDeferredValue(customerQuery.trim());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialPayment, setPartialPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [dueDate, setDueDate] = useState('');
  const [agreementNote, setAgreementNote] = useState('');

  const actor = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const canApprovePrice = actor.data
    ? hasPermission(actor.data, 'catalog:approve-price-exception')
    : false;
  const products = useQuery({
    queryKey: productCatalogQueryKey(deferredProductQuery),
    queryFn: () => searchProducts(deferredProductQuery),
    enabled: deferredProductQuery.length > 0,
  });
  const customers = useQuery({
    queryKey: customerSearchQueryKey(deferredCustomerQuery),
    queryFn: () => searchCustomers(deferredCustomerQuery),
    enabled: deferredCustomerQuery.length >= 2 && selectedCustomer === null,
  });
  const createCustomer = useMutation({
    mutationFn: registerCustomer,
    onSuccess(customer) {
      setSelectedCustomer(customer);
      setCreatingCustomer(false);
      setCustomerQuery('');
      setCustomerName('');
      setCustomerPhone('');
    },
  });

  const totalCents = useMemo(
    () =>
      lines.reduce(
        (total, line) =>
          total + (line.deliveryQuantity + line.reservationQuantity) * parseMoney(line.priceSoles),
        0,
      ),
    [lines],
  );
  const paymentCents =
    paymentMode === 'full'
      ? totalCents
      : paymentMode === 'partial'
        ? parseMoney(partialPayment)
        : 0;
  const balanceCents = Math.max(0, totalCents - paymentCents);
  const issues = validateSale({
    lines,
    totalCents,
    paymentCents,
    selectedCustomer,
    canApprovePrice,
  });

  const submitSale = useMutation({
    mutationFn: async () => {
      const input = draftInput(lines, selectedCustomer, dueDate, agreementNote);
      const signature = JSON.stringify(input);
      let draft = savedDraft.current?.draft;
      let operationId = savedDraft.current?.operationId ?? newOperationId();

      if (draft === undefined) {
        draft = await createSaleDraft(input);
        operationId = newOperationId();
      } else if (savedDraft.current?.signature !== signature) {
        draft = await updateSaleDraft(draft.id, input, draft.version);
        operationId = newOperationId();
      }

      savedDraft.current = { draft, signature, operationId };
      setHasSavedDraft(true);
      const priceExceptions = draft.lines.flatMap((draftLine, index) => {
        const line = lines[index];
        return line !== undefined && isBelowMinimum(line)
          ? [{ saleLineId: draftLine.id, reason: line.exceptionReason.trim() }]
          : [];
      });
      return confirmSale(draft.id, operationId, {
        expectedVersion: draft.version,
        priceExceptions,
        initialPayment:
          paymentCents > 0 ? { amountCents: paymentCents, method: paymentMethod } : null,
      });
    },
    onSuccess(result) {
      void queryClient.invalidateQueries({ queryKey: salesQueryRoot });
      router.push(`/sales/${result.saleId}`);
    },
  });

  function addProduct(product: Product) {
    if (lines.some((line) => line.product.id === product.id)) return;
    const firstPosition = product.stock.find((position) => position.availableQuantity > 0);
    if (firstPosition === undefined) return;
    lineCounter.current += 1;
    setLines((current) => [
      ...current,
      {
        key: `${product.id}-${String(lineCounter.current)}`,
        product,
        locationId: firstPosition.locationId,
        deliveryQuantity: 1,
        reservationQuantity: 0,
        priceSoles: centsToInput(product.suggestedPriceCents ?? product.minimumPriceCents),
        exceptionReason: '',
      },
    ]);
    setProductQuery('');
  }

  function updateLine(key: string, change: Partial<SaleLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (issues.length === 0) submitSale.mutate();
  }

  const productResults = products.data?.items ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => {
            router.push('/sales');
          }}
        >
          <Icon name="arrow" /> Volver a ventas
        </button>
        <p className={styles.kicker}>Nueva operación</p>
        <h1>Registrar venta</h1>
        <p>Arma la venta, define qué se entrega y confirma el cobro en un solo paso.</p>
      </header>

      <form className={styles.workspace} onSubmit={handleSubmit} noValidate>
        <div className={styles.mainColumn}>
          <section className={styles.section} aria-labelledby="products-title">
            <SectionHeading
              id="products-title"
              step="1"
              title="Productos de la venta"
              detail="Cada línea puede salir de tienda o almacén y dividirse entre entrega y separación."
            />
            <label className={styles.searchField} htmlFor="sale-product-search">
              <span>Buscar por código o nombre</span>
              <span className={styles.searchInput}>
                <Icon name="search" />
                <input
                  id="sale-product-search"
                  type="search"
                  value={productQuery}
                  onChange={(event) => {
                    setProductQuery(event.target.value);
                  }}
                  placeholder="Ejemplo: MUN-001 o muñeca"
                  autoComplete="off"
                />
              </span>
            </label>
            {deferredProductQuery ? (
              <div className={styles.pickerResults} aria-live="polite">
                {products.isPending ? <p>Buscando productos…</p> : null}
                {products.isError ? <p role="alert">{problemMessage(products.error)}</p> : null}
                {!products.isPending && !products.isError && productResults.length === 0 ? (
                  <p>No encontramos productos con esa búsqueda.</p>
                ) : null}
                {productResults.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => {
                      addProduct(product);
                    }}
                    disabled={
                      availableStock(product) === 0 ||
                      lines.some((line) => line.product.id === product.id)
                    }
                  >
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.code}</small>
                    </span>
                    <span>
                      {lines.some((line) => line.product.id === product.id)
                        ? 'Ya está en la venta'
                        : `${String(availableStock(product))} disponibles · ${formatMoney(product.suggestedPriceCents ?? product.minimumPriceCents)}`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {lines.length === 0 ? (
              <div className={styles.emptyLines}>
                <strong>La venta todavía no tiene productos</strong>
                <p>Busca el primer producto para comenzar a armarla.</p>
              </div>
            ) : (
              <div className={styles.lines}>
                {lines.map((line, index) => (
                  <SaleLineEditor
                    key={line.key}
                    line={line}
                    position={index + 1}
                    canApprovePrice={canApprovePrice}
                    onChange={(change) => {
                      updateLine(line.key, change);
                    }}
                    onRemove={() => {
                      setLines((current) => current.filter(({ key }) => key !== line.key));
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="customer-title">
            <SectionHeading
              id="customer-title"
              step="2"
              title="Cliente y acuerdo"
              detail="El cliente es opcional únicamente cuando la venta queda pagada por completo."
            />
            {selectedCustomer ? (
              <div className={styles.selectedCustomer}>
                <span>
                  <strong>{selectedCustomer.name}</strong>
                  <small>{selectedCustomer.phone}</small>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                  }}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <label className={styles.field} htmlFor="customer-search">
                  <span>Buscar cliente por nombre o teléfono</span>
                  <input
                    id="customer-search"
                    type="search"
                    value={customerQuery}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value);
                    }}
                    placeholder="Escribe al menos 2 caracteres"
                    autoComplete="off"
                  />
                </label>
                {deferredCustomerQuery.length >= 2 ? (
                  <div className={styles.customerResults} aria-live="polite">
                    {customers.isPending ? <p>Buscando clientes…</p> : null}
                    {customers.isError ? (
                      <p role="alert">{problemMessage(customers.error)}</p>
                    ) : null}
                    {customers.data?.map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery('');
                        }}
                      >
                        <strong>{customer.name}</strong>
                        <span>{customer.phone}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setCreatingCustomer((current) => !current);
                  }}
                >
                  {creatingCustomer ? 'Cancelar nuevo cliente' : 'Registrar cliente nuevo'}
                </button>
                {creatingCustomer ? (
                  <div className={styles.newCustomer}>
                    <label className={styles.field}>
                      <span>Nombre</span>
                      <input
                        value={customerName}
                        onChange={(event) => {
                          setCustomerName(event.target.value);
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Teléfono</span>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(event) => {
                          setCustomerPhone(event.target.value);
                        }}
                      />
                    </label>
                    {createCustomer.isError ? (
                      <p className={styles.inlineError} role="alert">
                        {problemMessage(createCustomer.error)}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className={styles.saveCustomerButton}
                      disabled={
                        customerName.trim().length === 0 ||
                        customerPhone.trim().length === 0 ||
                        createCustomer.isPending
                      }
                      onClick={() => {
                        createCustomer.mutate({
                          name: customerName.trim(),
                          phone: customerPhone.trim(),
                        });
                      }}
                    >
                      {createCustomer.isPending ? 'Guardando…' : 'Guardar y seleccionar'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
            <div className={styles.agreementFields}>
              <label className={styles.field}>
                <span>
                  Fecha esperada de pago <small>Opcional</small>
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => {
                    setDueDate(event.target.value);
                  }}
                />
              </label>
              <label className={styles.field}>
                <span>
                  Acuerdo de pago <small>Opcional</small>
                </span>
                <textarea
                  value={agreementNote}
                  onChange={(event) => {
                    setAgreementNote(event.target.value);
                  }}
                  placeholder="Ejemplo: abonará el saldo cada quincena"
                  rows={3}
                />
              </label>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="payment-title">
            <SectionHeading
              id="payment-title"
              step="3"
              title="Cobro inicial"
              detail="Este pago se registra junto con la confirmación de la venta."
            />
            <fieldset className={styles.paymentModes}>
              <legend>¿Cuánto paga ahora?</legend>
              {(
                [
                  ['full', 'Todo', 'Deja la venta pagada'],
                  ['partial', 'Una parte', 'Conserva saldo por cobrar'],
                  ['none', 'Nada aún', 'Registra toda la deuda'],
                ] as const
              ).map(([value, label, detail]) => (
                <label key={value} data-selected={paymentMode === value}>
                  <input
                    type="radio"
                    name="payment-mode"
                    value={value}
                    checked={paymentMode === value}
                    onChange={() => {
                      setPaymentMode(value);
                    }}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className={styles.paymentFields}>
              {paymentMode === 'partial' ? (
                <label className={styles.field}>
                  <span>Monto que paga ahora</span>
                  <span className={styles.moneyInput}>
                    <b>S/</b>
                    <input
                      aria-label="Monto que paga ahora"
                      inputMode="decimal"
                      value={partialPayment}
                      onChange={(event) => {
                        setPartialPayment(event.target.value);
                      }}
                      placeholder="0.00"
                    />
                  </span>
                </label>
              ) : null}
              {paymentMode !== 'none' ? (
                <label className={styles.field}>
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
              ) : null}
            </div>
          </section>
        </div>

        <aside className={styles.summary} aria-labelledby="summary-title">
          <p className={styles.kicker}>Resumen vivo</p>
          <h2 id="summary-title">Venta actual</h2>
          <dl>
            <div>
              <dt>Productos</dt>
              <dd>
                {lines.reduce(
                  (sum, line) => sum + line.deliveryQuantity + line.reservationQuantity,
                  0,
                )}
              </dd>
            </div>
            <div>
              <dt>Total acordado</dt>
              <dd>{formatMoney(totalCents)}</dd>
            </div>
            <div>
              <dt>Paga ahora</dt>
              <dd>{formatMoney(paymentCents)}</dd>
            </div>
            <div className={styles.openBalance} data-open={balanceCents > 0}>
              <dt>Saldo pendiente</dt>
              <dd>{formatMoney(balanceCents)}</dd>
            </div>
          </dl>
          {selectedCustomer ? (
            <p className={styles.summaryCustomer}>Cliente: {selectedCustomer.name}</p>
          ) : null}
          {issues.length > 0 ? (
            <div className={styles.issues} role="alert">
              <strong>Revisa antes de confirmar</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.ready}>La venta está lista para confirmarse.</p>
          )}
          {submitSale.isError ? (
            <div className={styles.submitError} role="alert">
              <strong>No pudimos confirmar la venta</strong>
              <p>{problemMessage(submitSale.error)}</p>
              {hasSavedDraft ? <small>El borrador quedó guardado para reintentar.</small> : null}
            </div>
          ) : null}
          <button
            className={styles.confirmButton}
            type="submit"
            disabled={issues.length > 0 || submitSale.isPending}
          >
            {submitSale.isPending ? 'Confirmando venta…' : 'Confirmar venta'}
          </button>
          <small className={styles.confirmNote}>
            Al confirmar se actualiza inventario y se registra el cobro indicado.
          </small>
        </aside>
      </form>
    </div>
  );
}

function SectionHeading({
  id,
  step,
  title,
  detail,
}: Readonly<{ id: string; step: string; title: string; detail: string }>) {
  return (
    <header className={styles.sectionHeading}>
      <span>{step}</span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{detail}</p>
      </div>
    </header>
  );
}

function SaleLineEditor({
  line,
  position,
  canApprovePrice,
  onChange,
  onRemove,
}: Readonly<{
  line: SaleLine;
  position: number;
  canApprovePrice: boolean;
  onChange: (change: Partial<SaleLine>) => void;
  onRemove: () => void;
}>) {
  const stock = line.product.stock.find(({ locationId }) => locationId === line.locationId);
  const quantity = line.deliveryQuantity + line.reservationQuantity;
  const belowMinimum = isBelowMinimum(line);
  return (
    <article className={styles.line}>
      <header>
        <span className={styles.lineNumber}>{position}</span>
        <div>
          <strong>{line.product.name}</strong>
          <small>{line.product.code}</small>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Quitar ${line.product.name}`}>
          Quitar
        </button>
      </header>
      <div className={styles.lineFields}>
        <label className={styles.field}>
          <span>Ubicación</span>
          <select
            value={line.locationId}
            onChange={(event) => {
              onChange({ locationId: event.target.value });
            }}
          >
            {line.product.stock.map((positionStock) => (
              <option key={positionStock.locationId} value={positionStock.locationId}>
                {positionStock.locationName} · {positionStock.availableQuantity} disp.
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Entrega ahora</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={line.deliveryQuantity}
            onChange={(event) => {
              onChange({ deliveryQuantity: positiveInteger(event.target.value) });
            }}
          />
        </label>
        <label className={styles.field}>
          <span>Separar</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={line.reservationQuantity}
            onChange={(event) => {
              onChange({ reservationQuantity: positiveInteger(event.target.value) });
            }}
          />
        </label>
        <label className={styles.field}>
          <span>Precio por unidad</span>
          <span className={styles.moneyInput}>
            <b>S/</b>
            <input
              aria-label={`Precio por unidad de ${line.product.name}`}
              inputMode="decimal"
              value={line.priceSoles}
              onChange={(event) => {
                onChange({ priceSoles: event.target.value });
              }}
            />
          </span>
        </label>
      </div>
      <div className={styles.lineFoot}>
        <span>
          {quantity} {quantity === 1 ? 'unidad' : 'unidades'} · {stock?.availableQuantity ?? 0}{' '}
          disponibles
        </span>
        <span>
          Mín. {formatMoney(line.product.minimumPriceCents)}
          {line.product.suggestedPriceCents === null
            ? ''
            : ` · Sugerido ${formatMoney(line.product.suggestedPriceCents)}`}
        </span>
        <strong>{formatMoney(quantity * parseMoney(line.priceSoles))}</strong>
      </div>
      {belowMinimum ? (
        canApprovePrice ? (
          <label className={styles.exceptionField}>
            <span>Razón para vender bajo el mínimo</span>
            <textarea
              rows={2}
              value={line.exceptionReason}
              onChange={(event) => {
                onChange({ exceptionReason: event.target.value });
              }}
              placeholder="Ejemplo: producto con defecto visible"
            />
          </label>
        ) : (
          <p className={styles.inlineError} role="alert">
            Solo un administrador puede aprobar un precio menor al mínimo.
          </p>
        )
      ) : null}
    </article>
  );
}

function draftInput(
  lines: SaleLine[],
  customer: Customer | null,
  dueDate: string,
  note: string,
): DraftInput {
  return {
    customerId: customer?.id ?? null,
    dueDate: dueDate || null,
    paymentAgreementNote: note.trim() || null,
    lines: lines.map((line) => ({
      productId: line.product.id,
      locationId: line.locationId,
      quantity: line.deliveryQuantity + line.reservationQuantity,
      deliveryQuantity: line.deliveryQuantity,
      reservationQuantity: line.reservationQuantity,
      agreedUnitPriceCents: parseMoney(line.priceSoles),
    })),
  };
}

function validateSale(input: {
  lines: SaleLine[];
  totalCents: number;
  paymentCents: number;
  selectedCustomer: Customer | null;
  canApprovePrice: boolean;
}): string[] {
  const issues: string[] = [];
  if (input.lines.length === 0) issues.push('Agrega al menos un producto.');
  input.lines.forEach((line, index) => {
    const quantity = line.deliveryQuantity + line.reservationQuantity;
    const available =
      line.product.stock.find(({ locationId }) => locationId === line.locationId)
        ?.availableQuantity ?? 0;
    if (quantity <= 0) issues.push(`La línea ${String(index + 1)} necesita al menos una unidad.`);
    if (quantity > available)
      issues.push(`La línea ${String(index + 1)} supera el stock disponible.`);
    if (parseMoney(line.priceSoles) <= 0)
      issues.push(`La línea ${String(index + 1)} necesita un precio válido.`);
    if (isBelowMinimum(line) && !input.canApprovePrice)
      issues.push(`El precio de la línea ${String(index + 1)} requiere aprobación administrativa.`);
    if (isBelowMinimum(line) && input.canApprovePrice && line.exceptionReason.trim().length === 0)
      issues.push(`Explica el precio menor al mínimo de la línea ${String(index + 1)}.`);
  });
  if (input.paymentCents > input.totalCents)
    issues.push('El cobro inicial no puede superar el total.');
  if (input.paymentCents < 0) issues.push('El cobro inicial debe ser válido.');
  if (input.totalCents > input.paymentCents && input.selectedCustomer === null)
    issues.push('Selecciona un cliente porque quedará saldo pendiente.');
  return issues;
}

function isBelowMinimum(line: SaleLine): boolean {
  return parseMoney(line.priceSoles) < line.product.minimumPriceCents;
}

function parseMoney(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
