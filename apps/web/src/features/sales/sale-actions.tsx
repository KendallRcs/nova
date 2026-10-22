'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type SyntheticEvent } from 'react';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import { newOperationId } from '@/shared/api/idempotency';
import { ApiProblem, problemMessage } from '@/shared/api/problem-details';
import { formatMoney } from '@/shared/formatters';
import {
  deliverSaleReservation,
  paymentMethodLabels,
  productSnapshot,
  recordSalePayment,
  saleDetailQueryKey,
  salesQueryRoot,
  type PaymentMethod,
  type SaleDetail,
} from './sales-api';
import styles from './sales.module.css';

type ActionKind = 'payment' | 'delivery';

interface OperationAttempt {
  signature: string;
  operationId: string;
}

export function SaleActions({ sale }: Readonly<{ sale: SaleDetail }>) {
  const actor = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const canPay =
    sale.lifecycle === 'confirmed' &&
    sale.balanceCents > 0 &&
    actor.data !== undefined &&
    (hasPermission(actor.data, 'payments:create-any') ||
      (sale.createdBy === actor.data.userId && hasPermission(actor.data, 'payments:create-own')));
  const reservableLines = sale.lines.filter((line) => line.activeReservationQuantity > 0);
  const canDeliver =
    sale.lifecycle === 'confirmed' &&
    reservableLines.length > 0 &&
    actor.data !== undefined &&
    (hasPermission(actor.data, 'sales:deliver-any') ||
      (sale.createdBy === actor.data.userId && hasPermission(actor.data, 'sales:deliver-own')));
  const [selectedAction, setSelectedAction] = useState<ActionKind | null>(null);
  const activeAction =
    selectedAction === 'payment' && canPay
      ? 'payment'
      : selectedAction === 'delivery' && canDeliver
        ? 'delivery'
        : canPay
          ? 'payment'
          : canDeliver
            ? 'delivery'
            : null;

  if (activeAction === null) return null;

  return (
    <section className={styles.actionDesk} aria-labelledby="pending-actions-title">
      <header className={styles.actionDeskHeader}>
        <div>
          <p className={styles.kicker}>Acciones pendientes</p>
          <h2 id="pending-actions-title">Continúa esta venta</h2>
        </div>
        {canPay && canDeliver ? (
          <div className={styles.actionSwitch} aria-label="Operación a registrar">
            <button
              type="button"
              aria-pressed={activeAction === 'payment'}
              onClick={() => {
                setSelectedAction('payment');
              }}
            >
              Registrar pago
            </button>
            <button
              type="button"
              aria-pressed={activeAction === 'delivery'}
              onClick={() => {
                setSelectedAction('delivery');
              }}
            >
              Registrar entrega
            </button>
          </div>
        ) : null}
      </header>
      {activeAction === 'payment' ? <PaymentForm sale={sale} /> : null}
      {activeAction === 'delivery' ? (
        <DeliveryForm sale={sale} reservableLines={reservableLines} />
      ) : null}
    </section>
  );
}

function PaymentForm({ sale }: Readonly<{ sale: SaleDetail }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<OperationAttempt | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [success, setSuccess] = useState<string | null>(null);
  const amountCents = parseMoney(amount);
  const issue =
    amountCents <= 0
      ? 'Ingresa un monto mayor que cero.'
      : amountCents > sale.balanceCents
        ? `El pago no puede superar el saldo de ${formatMoney(sale.balanceCents)}.`
        : null;
  const payment = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({ version: sale.version, amountCents, method });
      const operationId = operationIdFor(attempt, signature);
      return recordSalePayment({
        saleId: sale.id,
        operationId,
        expectedVersion: sale.version,
        amountCents,
        method,
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setAmount('');
      setSuccess(`Pago de ${formatMoney(result.amountCents)} registrado.`);
      void refreshSale(queryClient, sale.id);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refreshSale(queryClient, sale.id);
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) payment.mutate();
  }

  return (
    <form className={styles.operationForm} onSubmit={submit} noValidate>
      <div className={styles.operationIntro}>
        <strong>Registrar dinero recibido</strong>
        <p>
          Saldo actual: <b>{formatMoney(sale.balanceCents)}</b>. El movimiento quedará asociado a tu
          cuenta.
        </p>
      </div>
      <label className={styles.operationField}>
        <span>Monto recibido</span>
        <span className={styles.operationMoneyInput}>
          <b>S/</b>
          <input
            aria-label="Monto recibido"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setSuccess(null);
            }}
            placeholder="0.00"
          />
        </span>
        <button
          className={styles.fieldShortcut}
          type="button"
          onClick={() => {
            setAmount(centsToInput(sale.balanceCents));
          }}
        >
          Usar saldo total
        </button>
      </label>
      <label className={styles.operationField}>
        <span>Método de pago</span>
        <select
          value={method}
          onChange={(event) => {
            setMethod(event.target.value as PaymentMethod);
            setSuccess(null);
          }}
        >
          {Object.entries(paymentMethodLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <OperationFeedback mutation={payment} success={success} />
      <button
        className={styles.operationSubmit}
        type="submit"
        disabled={issue !== null || payment.isPending}
      >
        {payment.isPending ? 'Registrando pago…' : 'Confirmar pago'}
      </button>
      {issue !== null && amount.length > 0 ? <p className={styles.formHint}>{issue}</p> : null}
    </form>
  );
}

function DeliveryForm({
  sale,
  reservableLines,
}: Readonly<{ sale: SaleDetail; reservableLines: SaleDetail['lines'] }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<OperationAttempt | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const requestedLines = reservableLines.flatMap((line) => {
    const quantity = positiveInteger(quantities[line.id] ?? '');
    return quantity > 0 ? [{ saleLineId: line.id, quantity }] : [];
  });
  const invalidLine = reservableLines.find(
    (line) => positiveInteger(quantities[line.id] ?? '') > line.activeReservationQuantity,
  );
  const issue =
    invalidLine !== undefined
      ? `La entrega supera la reserva de ${productSnapshot(invalidLine).name}.`
      : requestedLines.length === 0
        ? 'Indica al menos una unidad para entregar.'
        : null;
  const delivery = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({ version: sale.version, lines: requestedLines });
      const operationId = operationIdFor(attempt, signature);
      return deliverSaleReservation({
        saleId: sale.id,
        operationId,
        expectedVersion: sale.version,
        lines: requestedLines,
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setQuantities({});
      setSuccess(
        `${String(result.deliveredQuantity)} ${result.deliveredQuantity === 1 ? 'unidad entregada' : 'unidades entregadas'}.`,
      );
      void refreshSale(queryClient, sale.id);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refreshSale(queryClient, sale.id);
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) delivery.mutate();
  }

  return (
    <form className={styles.deliveryForm} onSubmit={submit} noValidate>
      <div className={styles.operationIntro}>
        <strong>Entregar productos separados</strong>
        <p>Solo se muestran unidades que todavía permanecen reservadas para este cliente.</p>
      </div>
      <div className={styles.deliveryLines}>
        {reservableLines.map((line) => {
          const product = productSnapshot(line);
          return (
            <label key={line.id}>
              <span>
                <strong>{product.name}</strong>
                <small>
                  {line.locationName} · {line.activeReservationQuantity} reservadas
                </small>
              </span>
              <input
                aria-label={`Cantidad a entregar de ${product.name}`}
                type="number"
                inputMode="numeric"
                min="0"
                max={line.activeReservationQuantity}
                value={quantities[line.id] ?? ''}
                onChange={(event) => {
                  setQuantities((current) => ({ ...current, [line.id]: event.target.value }));
                  setSuccess(null);
                }}
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => {
                  setQuantities((current) => ({
                    ...current,
                    [line.id]: String(line.activeReservationQuantity),
                  }));
                }}
              >
                Todo
              </button>
            </label>
          );
        })}
      </div>
      <OperationFeedback mutation={delivery} success={success} />
      <button
        className={styles.operationSubmit}
        type="submit"
        disabled={issue !== null || delivery.isPending}
      >
        {delivery.isPending ? 'Registrando entrega…' : 'Confirmar entrega'}
      </button>
      {issue !== null && requestedLines.length > 0 ? (
        <p className={styles.formHint}>{issue}</p>
      ) : null}
    </form>
  );
}

function OperationFeedback({
  mutation,
  success,
}: Readonly<{
  mutation: { isError: boolean; error: Error | null };
  success: string | null;
}>) {
  if (success !== null)
    return (
      <p className={styles.operationSuccess} role="status">
        {success}
      </p>
    );
  if (mutation.isError)
    return (
      <div className={styles.operationError} role="alert">
        <strong>No pudimos registrar la operación</strong>
        <p>{problemMessage(mutation.error)}</p>
        <small>Puedes revisar los datos y volver a intentarlo sin duplicar el movimiento.</small>
      </div>
    );
  return null;
}

function operationIdFor(attempt: { current: OperationAttempt | null }, signature: string): string {
  if (attempt.current?.signature === signature) return attempt.current.operationId;
  const operationId = newOperationId();
  attempt.current = { signature, operationId };
  return operationId;
}

async function refreshSale(queryClient: ReturnType<typeof useQueryClient>, saleId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: saleDetailQueryKey(saleId) }),
    queryClient.invalidateQueries({ queryKey: salesQueryRoot }),
  ]);
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiProblem && error.problem.status === 409;
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
