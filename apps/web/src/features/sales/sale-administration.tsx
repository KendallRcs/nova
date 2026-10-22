'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type SyntheticEvent } from 'react';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import { newOperationId } from '@/shared/api/idempotency';
import { ApiProblem, problemMessage } from '@/shared/api/problem-details';
import { formatDateTime, formatMoney } from '@/shared/formatters';
import {
  adjustSaleTotal,
  approveSaleReturn,
  cancelSale,
  correctSalePayment,
  finalizeSale,
  listInventoryLocations,
  paymentMethodLabels,
  productSnapshot,
  saleDetailQueryKey,
  salesQueryRoot,
  type PaymentMethod,
  type CancellationLineInput,
  type ReturnLineInput,
  type SaleDetail,
} from './sales-api';
import styles from './sales.module.css';

type AdminAction = 'return' | 'correction' | 'adjustment' | 'closure' | 'cancellation';
interface Attempt {
  signature: string;
  operationId: string;
}
interface ReturnDraft {
  quantity: string;
  productReturns: boolean;
  returnLocationId: string;
  condition: 'available' | 'review';
}
interface CancellationDraft {
  returnedQuantity: string;
  returnLocationId: string;
  condition: 'available' | 'review';
}

export function SaleAdministration({ sale }: Readonly<{ sale: SaleDetail }>) {
  const actor = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const returnableLines = sale.lines.flatMap((line) => {
    const available = deliveredQuantity(sale, line.id) - returnedQuantity(sale, line.id);
    return available > 0 ? [{ line, available }] : [];
  });
  const correctablePayments = sale.payments.filter((payment) => payment.netAmountCents > 0);
  const canReturn =
    (sale.lifecycle === 'confirmed' || sale.lifecycle === 'finalized') &&
    returnableLines.length > 0 &&
    actor.data !== undefined &&
    hasPermission(actor.data, 'returns:approve');
  const canCorrect =
    sale.lifecycle === 'confirmed' &&
    sale.customer !== null &&
    correctablePayments.length > 0 &&
    actor.data !== undefined &&
    hasPermission(actor.data, 'payments:correct');
  const canClose =
    sale.lifecycle === 'confirmed' &&
    actor.data !== undefined &&
    hasPermission(actor.data, 'sales:finalize-with-balance');
  const canAdjust =
    sale.lifecycle === 'confirmed' &&
    actor.data !== undefined &&
    hasPermission(actor.data, 'sales:adjust-confirmed');
  const canCancel =
    sale.lifecycle === 'confirmed' &&
    actor.data !== undefined &&
    hasPermission(actor.data, 'sales:cancel');
  const [active, setActive] = useState<AdminAction | null>(null);

  if (!canReturn && !canCorrect && !canAdjust && !canClose && !canCancel) return null;

  return (
    <section className={styles.adminDesk} aria-labelledby="sale-administration-title">
      <header className={styles.adminDeskHeader}>
        <div>
          <p className={styles.kicker}>Solo administración</p>
          <h2 id="sale-administration-title">Corregir o cerrar la venta</h2>
          <p>Estas operaciones modifican dinero, inventario o el estado final de la venta.</p>
        </div>
        {active !== null ? (
          <button
            className={styles.adminBack}
            type="button"
            onClick={() => {
              setActive(null);
            }}
          >
            Elegir otra acción
          </button>
        ) : null}
      </header>

      {active === null ? (
        <div className={styles.adminChoices}>
          {canReturn ? (
            <AdminChoice
              title="Registrar devolución"
              detail="Retira productos de la venta y registra si regresan al inventario."
              onClick={() => {
                setActive('return');
              }}
            />
          ) : null}
          {canCorrect ? (
            <AdminChoice
              title="Corregir un pago"
              detail="Compensa un cobro erróneo sin borrar su registro original."
              onClick={() => {
                setActive('correction');
              }}
            />
          ) : null}
          {canAdjust ? (
            <AdminChoice
              title="Ajustar total acordado"
              detail="Registra un nuevo acuerdo económico sin reemplazar el total original."
              onClick={() => {
                setActive('adjustment');
              }}
            />
          ) : null}
          {canClose ? (
            <AdminChoice
              title="Finalizar venta"
              detail={
                sale.balanceCents > 0
                  ? 'Cierra el seguimiento y registra el saldo que ya no se cobrará.'
                  : 'Marca como completo el acuerdo ya pagado.'
              }
              onClick={() => {
                setActive('closure');
              }}
            />
          ) : null}
          {canCancel ? (
            <AdminChoice
              title="Cancelar venta"
              detail="Cierra la operación declarando productos, reservas y cualquier reembolso real."
              danger
              onClick={() => {
                setActive('cancellation');
              }}
            />
          ) : null}
        </div>
      ) : null}
      {active === 'return' && canReturn ? (
        <ReturnForm sale={sale} returnableLines={returnableLines} />
      ) : null}
      {active === 'correction' && canCorrect ? (
        <CorrectionForm sale={sale} payments={correctablePayments} />
      ) : null}
      {active === 'adjustment' && canAdjust ? <AdjustmentForm sale={sale} /> : null}
      {active === 'closure' && canClose ? <ClosureForm sale={sale} /> : null}
      {active === 'cancellation' && canCancel ? <CancellationForm sale={sale} /> : null}
    </section>
  );
}

function AdminChoice({
  title,
  detail,
  danger = false,
  onClick,
}: Readonly<{ title: string; detail: string; danger?: boolean; onClick: () => void }>) {
  return (
    <button type="button" data-danger={danger} onClick={onClick}>
      <strong>{title}</strong>
      <span>{detail}</span>
      <b aria-hidden="true">Abrir →</b>
    </button>
  );
}

function CorrectionForm({
  sale,
  payments,
}: Readonly<{ sale: SaleDetail; payments: SaleDetail['payments'] }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const [paymentId, setPaymentId] = useState(payments[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const selected = payments.find((payment) => payment.id === paymentId) ?? payments[0];
  const amountCents = parseMoney(amount);
  const issue =
    selected === undefined
      ? 'Selecciona un pago.'
      : amountCents <= 0
        ? 'Ingresa un monto mayor que cero.'
        : amountCents > selected.netAmountCents
          ? `La corrección no puede superar ${formatMoney(selected.netAmountCents)}.`
          : reason.trim().length === 0
            ? 'Escribe la razón de la corrección.'
            : null;
  const correction = useMutation({
    mutationFn: async () => {
      if (selected === undefined) throw new Error('Payment selection is unavailable.');
      const signature = JSON.stringify({
        saleVersion: sale.version,
        paymentId,
        amountCents,
        reason,
      });
      return correctSalePayment({
        saleId: sale.id,
        paymentId,
        operationId: operationIdFor(attempt, signature),
        expectedVersion: sale.version,
        amountCents,
        reason: reason.trim(),
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setAmount('');
      setReason('');
      setSuccess(`Corrección de ${formatMoney(result.amountCents)} registrada.`);
      void refresh(sale.id, queryClient);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refresh(sale.id, queryClient);
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) correction.mutate();
  }

  return (
    <form className={styles.adminForm} onSubmit={submit} noValidate>
      <div className={styles.adminFormIntro}>
        <strong>Corrección compensatoria</strong>
        <p>El pago original seguirá visible. Nova registrará una salida por el mismo método.</p>
      </div>
      <label className={styles.adminField}>
        <span>Pago a corregir</span>
        <select
          value={paymentId}
          onChange={(event) => {
            setPaymentId(event.target.value);
          }}
        >
          {payments.map((payment) => (
            <option key={payment.id} value={payment.id}>
              {formatMoney(payment.netAmountCents)} · {paymentMethodLabels[payment.method]} ·{' '}
              {formatDateTime(payment.effectiveAt)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.adminField}>
        <span>Monto a corregir</span>
        <span className={styles.operationMoneyInput}>
          <b>S/</b>
          <input
            aria-label="Monto a corregir"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            placeholder="0.00"
          />
        </span>
        {selected ? (
          <button
            className={styles.fieldShortcut}
            type="button"
            onClick={() => {
              setAmount(centsToInput(selected.netAmountCents));
            }}
          >
            Corregir todo
          </button>
        ) : null}
      </label>
      <label className={[styles.adminField, styles.adminReason].join(' ')}>
        <span>Razón obligatoria</span>
        <textarea
          value={reason}
          maxLength={500}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Ej. Se registró un monto incorrecto"
        />
      </label>
      <AdminFeedback mutation={correction} success={success} />
      <button
        className={styles.adminSubmit}
        type="submit"
        disabled={issue !== null || correction.isPending}
      >
        {correction.isPending ? 'Registrando…' : 'Confirmar corrección'}
      </button>
      {issue !== null && (amount.length > 0 || reason.length > 0) ? (
        <p className={styles.adminHint}>{issue}</p>
      ) : null}
    </form>
  );
}

function AdjustmentForm({ sale }: Readonly<{ sale: SaleDetail }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const [newTotal, setNewTotal] = useState(centsToInput(sale.currentTotalCents));
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const newTotalCents = parseMoney(newTotal);
  const differenceCents = newTotalCents - sale.currentTotalCents;
  const resultingBalanceCents = Math.max(0, newTotalCents - sale.paidCents);
  const issue =
    newTotalCents < sale.paidCents
      ? `El nuevo total no puede ser menor que los ${formatMoney(sale.paidCents)} ya cobrados.`
      : newTotalCents > sale.paidCents && sale.customer === null
        ? 'Asocia un cliente antes de crear un saldo pendiente.'
        : reason.trim().length === 0
          ? 'Escribe la razón del nuevo acuerdo.'
          : null;
  const adjustment = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({ saleVersion: sale.version, newTotalCents, reason });
      return adjustSaleTotal({
        saleId: sale.id,
        operationId: operationIdFor(attempt, signature),
        expectedVersion: sale.version,
        newTotalCents,
        reason: reason.trim(),
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setSuccess(`Nuevo total de ${formatMoney(result.currentTotalCents)} registrado.`);
      void refresh(sale.id, queryClient);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refresh(sale.id, queryClient);
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) adjustment.mutate();
  }

  return (
    <form className={styles.adminForm} onSubmit={submit} noValidate>
      <div className={styles.adminFormIntro}>
        <strong>Nuevo acuerdo económico</strong>
        <p>
          El total original de {formatMoney(sale.originalTotalCents)} permanecerá en el historial.
        </p>
      </div>
      <label className={styles.adminField}>
        <span>Nuevo total acordado</span>
        <span className={styles.operationMoneyInput}>
          <b>S/</b>
          <input
            aria-label="Nuevo total acordado"
            inputMode="decimal"
            value={newTotal}
            onChange={(event) => {
              setNewTotal(event.target.value);
              setSuccess(null);
            }}
          />
        </span>
      </label>
      <div className={styles.adjustmentPreview}>
        <span>{differenceCents < 0 ? 'Reducción' : 'Incremento'}</span>
        <strong>{formatMoney(Math.abs(differenceCents))}</strong>
        <small>Saldo resultante: {formatMoney(resultingBalanceCents)}</small>
      </div>
      <label className={[styles.adminField, styles.adminReason].join(' ')}>
        <span>Razón obligatoria</span>
        <textarea
          value={reason}
          maxLength={500}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Ej. Se acordó un importe diferente con el cliente"
        />
      </label>
      <AdminFeedback mutation={adjustment} success={success} />
      <button
        className={styles.adminSubmit}
        type="submit"
        disabled={issue !== null || adjustment.isPending}
      >
        {adjustment.isPending ? 'Registrando…' : 'Confirmar nuevo total'}
      </button>
      {issue !== null && (newTotalCents !== sale.currentTotalCents || reason.length > 0) ? (
        <p className={styles.adminHint}>{issue}</p>
      ) : null}
    </form>
  );
}

function ClosureForm({ sale }: Readonly<{ sale: SaleDetail }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const needsReason = sale.balanceCents > 0;
  const issue =
    needsReason && reason.trim().length === 0 ? 'Explica por qué no se cobrará el saldo.' : null;
  const closure = useMutation({
    mutationFn: async () => {
      const normalizedReason = needsReason ? reason.trim() : null;
      const signature = JSON.stringify({ saleVersion: sale.version, reason: normalizedReason });
      return finalizeSale({
        saleId: sale.id,
        operationId: operationIdFor(attempt, signature),
        expectedVersion: sale.version,
        reason: normalizedReason,
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setSuccess(
        result.type === 'complete'
          ? 'Venta finalizada como completa.'
          : `Venta finalizada con ${formatMoney(result.forgivenAmountCents)} sin cobrar.`,
      );
      void refresh(sale.id, queryClient);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refresh(sale.id, queryClient);
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) closure.mutate();
  }

  return (
    <form className={styles.adminForm} onSubmit={submit} noValidate>
      <div className={styles.adminFormIntro}>
        <strong>
          {needsReason ? 'Finalizar con saldo pendiente' : 'Finalizar venta completa'}
        </strong>
        <p>
          {needsReason
            ? `${formatMoney(sale.balanceCents)} quedará registrado como importe no cobrado y ya no se admitirán pagos.`
            : 'El acuerdo está pagado. Al finalizar, la venta dejará de aceptar cambios financieros.'}
        </p>
      </div>
      {needsReason ? (
        <label className={[styles.adminField, styles.adminReason].join(' ')}>
          <span>Razón obligatoria</span>
          <textarea
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder="Ej. Se acordó dar por concluida la deuda"
          />
        </label>
      ) : null}
      <AdminFeedback mutation={closure} success={success} />
      <button
        className={styles.adminSubmit}
        type="submit"
        disabled={issue !== null || closure.isPending}
      >
        {closure.isPending
          ? 'Finalizando…'
          : needsReason
            ? 'Finalizar sin cobrar saldo'
            : 'Finalizar venta'}
      </button>
      {issue !== null && reason.length > 0 ? <p className={styles.adminHint}>{issue}</p> : null}
    </form>
  );
}

function ReturnForm({
  sale,
  returnableLines,
}: Readonly<{
  sale: SaleDetail;
  returnableLines: { line: SaleDetail['lines'][number]; available: number }[];
}>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: listInventoryLocations,
  });
  const [drafts, setDrafts] = useState<Record<string, ReturnDraft>>({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [success, setSuccess] = useState<string | null>(null);
  const requested = returnableLines.flatMap(({ line, available }) => {
    const draft = drafts[line.id];
    const quantity = positiveInteger(draft?.quantity ?? '');
    if (quantity <= 0) return [];
    return [{ line, available, quantity, draft: draft ?? emptyReturnDraft() }];
  });
  const reductionCents = requested.reduce(
    (sum, item) => sum + item.line.agreedUnitPriceCents * item.quantity,
    0,
  );
  const refundCents = Math.max(0, sale.paidCents - (sale.currentTotalCents - reductionCents));
  const lines: ReturnLineInput[] = requested.map(({ line, quantity, draft }) => ({
    saleLineId: line.id,
    quantity,
    productReturns: draft.productReturns,
    returnLocationId: draft.productReturns ? draft.returnLocationId || null : null,
    condition: draft.productReturns ? draft.condition : null,
  }));
  const excessive = requested.find(({ quantity, available }) => quantity > available);
  const incompleteReturn = requested.find(
    ({ draft }) => draft.productReturns && draft.returnLocationId.length === 0,
  );
  const issue =
    requested.length === 0
      ? 'Selecciona al menos una unidad entregada.'
      : excessive !== undefined
        ? `La cantidad supera las ${String(excessive.available)} unidades disponibles para devolución.`
        : incompleteReturn !== undefined
          ? 'Elige la ubicación a la que regresará cada producto.'
          : reason.trim().length === 0
            ? 'Escribe la razón de la devolución.'
            : null;
  const saleReturn = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({ saleVersion: sale.version, reason, refundMethod, lines });
      return approveSaleReturn({
        saleId: sale.id,
        operationId: operationIdFor(attempt, signature),
        expectedVersion: sale.version,
        reason: reason.trim(),
        refundMethod: refundCents > 0 ? refundMethod : null,
        lines,
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setDrafts({});
      setReason('');
      setSuccess(
        result.refundAmountCents > 0
          ? `Devolución registrada y ${formatMoney(result.refundAmountCents)} reembolsados.`
          : 'Devolución registrada sin reembolso.',
      );
      void refresh(sale.id, queryClient);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refresh(sale.id, queryClient);
    },
  });

  function updateDraft(lineId: string, update: Partial<ReturnDraft>) {
    setDrafts((current) => ({
      ...current,
      [lineId]: { ...(current[lineId] ?? emptyReturnDraft()), ...update },
    }));
    setSuccess(null);
  }
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) saleReturn.mutate();
  }

  return (
    <form className={styles.returnForm} onSubmit={submit} noValidate>
      <div className={styles.adminFormIntro}>
        <strong>Productos entregados a devolver</strong>
        <p>
          El total se reducirá por las unidades elegidas. Indica por línea si el producto vuelve
          físicamente.
        </p>
      </div>
      <div className={styles.returnLines}>
        {returnableLines.map(({ line, available }) => {
          const product = productSnapshot(line);
          const draft = drafts[line.id] ?? emptyReturnDraft();
          return (
            <article key={line.id}>
              <div className={styles.returnProduct}>
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {available} {available === 1 ? 'unidad disponible' : 'unidades disponibles'}{' '}
                    para devolución
                  </small>
                </span>
                <label>
                  <span>Cantidad</span>
                  <input
                    aria-label={`Cantidad a devolver de ${product.name}`}
                    type="number"
                    min="0"
                    max={available}
                    value={draft.quantity}
                    onChange={(event) => {
                      updateDraft(line.id, { quantity: event.target.value });
                    }}
                    placeholder="0"
                  />
                </label>
              </div>
              {positiveInteger(draft.quantity) > 0 ? (
                <div className={styles.returnTreatment}>
                  <label className={styles.returnCheck}>
                    <input
                      type="checkbox"
                      checked={draft.productReturns}
                      onChange={(event) => {
                        updateDraft(line.id, { productReturns: event.target.checked });
                      }}
                    />
                    El producto regresa al negocio
                  </label>
                  {draft.productReturns ? (
                    <>
                      <label>
                        <span>Ubicación</span>
                        <select
                          aria-label={`Ubicación de retorno de ${product.name}`}
                          value={draft.returnLocationId}
                          onChange={(event) => {
                            updateDraft(line.id, { returnLocationId: event.target.value });
                          }}
                        >
                          <option value="">Seleccionar</option>
                          {(locations.data ?? []).map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Condición</span>
                        <select
                          aria-label={`Condición de retorno de ${product.name}`}
                          value={draft.condition}
                          onChange={(event) => {
                            updateDraft(line.id, {
                              condition: event.target.value as 'available' | 'review',
                            });
                          }}
                        >
                          <option value="available">Disponible para venta</option>
                          <option value="review">Requiere revisión</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <small>No se incrementará el inventario.</small>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className={styles.returnSummary}>
        <div>
          <span>Reducción estimada</span>
          <strong>{formatMoney(reductionCents)}</strong>
        </div>
        <div>
          <span>Reembolso calculado</span>
          <strong>{formatMoney(refundCents)}</strong>
        </div>
        {refundCents > 0 ? (
          <label className={styles.adminField}>
            <span>Método del reembolso</span>
            <select
              value={refundMethod}
              onChange={(event) => {
                setRefundMethod(event.target.value as PaymentMethod);
              }}
            >
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>Lo pagado no supera el nuevo total; no corresponde devolver dinero.</p>
        )}
      </div>
      <label className={[styles.adminField, styles.returnReason].join(' ')}>
        <span>Razón obligatoria</span>
        <textarea
          value={reason}
          maxLength={500}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Ej. El cliente ya no desea el producto"
        />
      </label>
      <AdminFeedback mutation={saleReturn} success={success} />
      <button
        className={styles.adminSubmit}
        type="submit"
        disabled={issue !== null || saleReturn.isPending}
      >
        {saleReturn.isPending ? 'Registrando…' : 'Confirmar devolución'}
      </button>
      {issue !== null && (requested.length > 0 || reason.length > 0) ? (
        <p className={styles.adminHint}>{issue}</p>
      ) : null}
    </form>
  );
}

function CancellationForm({ sale }: Readonly<{ sale: SaleDetail }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const locations = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: listInventoryLocations,
  });
  const [drafts, setDrafts] = useState<Record<string, CancellationDraft>>({});
  const [refund, setRefund] = useState('0.00');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const refundAmountCents = parseMoney(refund);
  const lineStates = sale.lines.map((line) => {
    const unresolvedDelivered = Math.max(
      0,
      deliveredQuantity(sale, line.id) - returnedQuantity(sale, line.id),
    );
    const draft = drafts[line.id] ?? emptyCancellationDraft();
    const returned = positiveInteger(draft.returnedQuantity);
    return {
      line,
      unresolvedDelivered,
      returned,
      notReturned: unresolvedDelivered - returned,
      draft,
    };
  });
  const lines: CancellationLineInput[] = lineStates.map(
    ({ line, returned, notReturned, draft }) => ({
      saleLineId: line.id,
      returnedQuantity: returned,
      notReturnedQuantity: Math.max(0, notReturned),
      returnLocationId: returned > 0 ? draft.returnLocationId || null : null,
      condition: returned > 0 ? draft.condition : null,
    }),
  );
  const excessive = lineStates.find(
    ({ returned, unresolvedDelivered }) => returned > unresolvedDelivered,
  );
  const missingLocation = lineStates.find(
    ({ returned, draft }) => returned > 0 && draft.returnLocationId.length === 0,
  );
  const issue =
    excessive !== undefined
      ? `No pueden retornar más de ${String(excessive.unresolvedDelivered)} unidades de ${productSnapshot(excessive.line).name}.`
      : missingLocation !== undefined
        ? 'Elige la ubicación para cada producto que regresa.'
        : refundAmountCents > sale.paidCents
          ? `El reembolso no puede superar los ${formatMoney(sale.paidCents)} cobrados.`
          : reason.trim().length === 0
            ? 'Escribe la razón de la cancelación.'
            : null;
  const cancellation = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({
        saleVersion: sale.version,
        refundAmountCents,
        refundMethod,
        reason,
        lines,
      });
      return cancelSale({
        saleId: sale.id,
        operationId: operationIdFor(attempt, signature),
        expectedVersion: sale.version,
        reason: reason.trim(),
        refundAmountCents,
        refundMethod: refundAmountCents > 0 ? refundMethod : null,
        lines,
      });
    },
    onSuccess(result) {
      attempt.current = null;
      setSuccess(
        result.refundAmountCents > 0
          ? `Venta cancelada y ${formatMoney(result.refundAmountCents)} reembolsados.`
          : 'Venta cancelada sin reembolso.',
      );
      void refresh(sale.id, queryClient);
    },
    onError(error) {
      setSuccess(null);
      if (isConflict(error)) void refresh(sale.id, queryClient);
    },
  });

  function updateDraft(lineId: string, update: Partial<CancellationDraft>) {
    setDrafts((current) => ({
      ...current,
      [lineId]: { ...(current[lineId] ?? emptyCancellationDraft()), ...update },
    }));
    setSuccess(null);
  }
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (issue === null) cancellation.mutate();
  }

  return (
    <form className={styles.cancellationForm} onSubmit={submit} noValidate>
      <div className={styles.cancellationNotice}>
        <strong>La cancelación finaliza esta venta</strong>
        <p>
          Nova liberará automáticamente las reservas activas. Los pagos anteriores permanecerán en
          el historial y solo saldrá de caja el reembolso que declares.
        </p>
      </div>
      <div className={styles.cancellationLines}>
        {lineStates.map(({ line, unresolvedDelivered, returned, notReturned, draft }) => {
          const product = productSnapshot(line);
          return (
            <article key={line.id}>
              <div className={styles.cancellationProduct}>
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {unresolvedDelivered} entregadas pendientes de resolver
                    {line.activeReservationQuantity > 0
                      ? ` · ${String(line.activeReservationQuantity)} reservadas se liberarán`
                      : ''}
                  </small>
                </span>
                <label>
                  <span>Unidades que regresan</span>
                  <input
                    aria-label={`Unidades que regresan de ${product.name}`}
                    type="number"
                    min="0"
                    max={unresolvedDelivered}
                    value={draft.returnedQuantity}
                    onChange={(event) => {
                      updateDraft(line.id, { returnedQuantity: event.target.value });
                    }}
                  />
                </label>
                <span className={styles.customerKeeps}>
                  <small>Permanece con el cliente</small>
                  <strong>{Math.max(0, notReturned)}</strong>
                </span>
              </div>
              {returned > 0 ? (
                <div className={styles.returnTreatment}>
                  <span />
                  <label>
                    <span>Ubicación de retorno</span>
                    <select
                      aria-label={`Ubicación de cancelación de ${product.name}`}
                      value={draft.returnLocationId}
                      onChange={(event) => {
                        updateDraft(line.id, { returnLocationId: event.target.value });
                      }}
                    >
                      <option value="">Seleccionar</option>
                      {(locations.data ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Condición</span>
                    <select
                      aria-label={`Condición al cancelar de ${product.name}`}
                      value={draft.condition}
                      onChange={(event) => {
                        updateDraft(line.id, {
                          condition: event.target.value as 'available' | 'review',
                        });
                      }}
                    >
                      <option value="available">Disponible para venta</option>
                      <option value="review">Requiere revisión</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className={styles.cancellationMoney}>
        <div>
          <span>Cobrado vigente</span>
          <strong>{formatMoney(sale.paidCents)}</strong>
        </div>
        <label className={styles.adminField}>
          <span>Reembolso real</span>
          <span className={styles.operationMoneyInput}>
            <b>S/</b>
            <input
              aria-label="Reembolso real"
              inputMode="decimal"
              value={refund}
              onChange={(event) => {
                setRefund(event.target.value);
                setSuccess(null);
              }}
            />
          </span>
        </label>
        {refundAmountCents > 0 ? (
          <label className={styles.adminField}>
            <span>Método del reembolso</span>
            <select
              value={refundMethod}
              onChange={(event) => {
                setRefundMethod(event.target.value as PaymentMethod);
              }}
            >
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>No se registrará ninguna salida de dinero.</p>
        )}
      </div>
      <label className={[styles.adminField, styles.returnReason].join(' ')}>
        <span>Razón obligatoria</span>
        <textarea
          value={reason}
          maxLength={500}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Ej. El cliente desistió de la compra"
        />
      </label>
      <AdminFeedback mutation={cancellation} success={success} />
      <button
        className={[styles.adminSubmit, styles.cancelSubmit].join(' ')}
        type="submit"
        disabled={issue !== null || cancellation.isPending}
      >
        {cancellation.isPending ? 'Cancelando…' : 'Cancelar venta definitivamente'}
      </button>
      {issue !== null && (reason.length > 0 || refund !== '0.00') ? (
        <p className={styles.adminHint}>{issue}</p>
      ) : null}
    </form>
  );
}

function AdminFeedback({
  mutation,
  success,
}: Readonly<{ mutation: { isError: boolean; error: Error | null }; success: string | null }>) {
  if (success !== null)
    return (
      <p className={styles.operationSuccess} role="status">
        {success}
      </p>
    );
  if (!mutation.isError) return null;
  return (
    <div className={styles.operationError} role="alert">
      <strong>No pudimos registrar la operación</strong>
      <p>{problemMessage(mutation.error)}</p>
      <small>Revisa los datos y vuelve a intentarlo; el reintento no duplicará movimientos.</small>
    </div>
  );
}

function emptyReturnDraft(): ReturnDraft {
  return { quantity: '', productReturns: false, returnLocationId: '', condition: 'available' };
}
function emptyCancellationDraft(): CancellationDraft {
  return { returnedQuantity: '0', returnLocationId: '', condition: 'available' };
}
function deliveredQuantity(sale: SaleDetail, saleLineId: string): number {
  const line = sale.lines.find((candidate) => candidate.id === saleLineId);
  const later = sale.deliveries.reduce((total, delivery) => {
    if (!isRecord(delivery) || !Array.isArray(delivery.lines)) return total;
    const lines: unknown[] = delivery.lines;
    return (
      total +
      lines.reduce(
        (lineTotal: number, candidate: unknown) =>
          lineTotal +
          (isRecord(candidate) &&
          candidate.saleLineId === saleLineId &&
          typeof candidate.quantity === 'number'
            ? candidate.quantity
            : 0),
        0,
      )
    );
  }, 0);
  return (line?.deliveryQuantity ?? 0) + later;
}
function returnedQuantity(sale: SaleDetail, saleLineId: string): number {
  return sale.returns.reduce((total, saleReturn) => {
    if (!isRecord(saleReturn) || !Array.isArray(saleReturn.lines)) return total;
    const lines: unknown[] = saleReturn.lines;
    return (
      total +
      lines.reduce(
        (lineTotal: number, candidate: unknown) =>
          lineTotal +
          (isRecord(candidate) &&
          candidate.saleLineId === saleLineId &&
          typeof candidate.quantity === 'number'
            ? candidate.quantity
            : 0),
        0,
      )
    );
  }, 0);
}
function operationIdFor(attempt: { current: Attempt | null }, signature: string): string {
  if (attempt.current?.signature === signature) return attempt.current.operationId;
  const operationId = newOperationId();
  attempt.current = { signature, operationId };
  return operationId;
}
async function refresh(saleId: string, queryClient: ReturnType<typeof useQueryClient>) {
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
