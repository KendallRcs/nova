'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { ApiProblem, problemMessage } from '@/shared/api/problem-details';
import { formatDate, formatDateTime, formatMoney } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import { SaleActions } from './sale-actions';
import { SaleAdministration } from './sale-administration';
import {
  deliveryLabels,
  getSaleDetail,
  lifecycleLabels,
  paymentLabels,
  paymentMethodLabels,
  productSnapshot,
  saleDetailQueryKey,
  saleReference,
  type SaleDetail,
} from './sales-api';
import styles from './sales.module.css';

export function SaleDetailScreen({ saleId }: Readonly<{ saleId: string }>) {
  const sale = useQuery({
    queryKey: saleDetailQueryKey(saleId),
    queryFn: () => getSaleDetail(saleId),
  });
  if (sale.isPending) return <DetailSkeleton />;
  if (sale.isError) {
    const problem = sale.error instanceof ApiProblem ? sale.error.problem : null;
    const unavailable = problem?.status === 404 || problem?.status === 403;
    return (
      <div className={styles.detailPage}>
        <BackLink />
        <Feedback
          title={
            problem?.status === 403
              ? 'No puedes consultar esta venta'
              : unavailable
                ? 'Esta venta no está disponible'
                : 'No pudimos cargar la venta'
          }
          detail={
            unavailable
              ? 'Verifica el enlace o vuelve al listado de ventas.'
              : problemMessage(sale.error)
          }
          {...(unavailable
            ? {}
            : {
                retry: () => {
                  void sale.refetch();
                },
              })}
        />
      </div>
    );
  }
  const item = sale.data;
  const paidPercent =
    item.currentTotalCents <= 0
      ? 100
      : Math.min(100, Math.round((item.paidCents / item.currentTotalCents) * 100));
  return (
    <div className={styles.detailPage}>
      <BackLink />
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.reference}>V-{saleReference(item.id)}</span>
          <h1>{item.customer?.name ?? 'Venta sin cliente'}</h1>
          <p>
            Registrada por {item.creatorUsername} · {formatDateTime(item.createdAt)}
          </p>
        </div>
        <div className={styles.detailStates}>
          <span className={styles.lifecycle} data-state={item.lifecycle}>
            {lifecycleLabels[item.lifecycle]}
          </span>
          {item.overdue ? <span className={styles.overdue}>Pago atrasado</span> : null}
        </div>
      </header>

      <section className={styles.moneySummary} aria-label="Resumen de la venta">
        <div>
          <span>Total acordado</span>
          <strong>{formatMoney(item.currentTotalCents)}</strong>
          {item.originalTotalCents !== item.currentTotalCents ? (
            <small>Original: {formatMoney(item.originalTotalCents)}</small>
          ) : null}
        </div>
        <div>
          <span>Total cobrado</span>
          <strong>{formatMoney(item.paidCents)}</strong>
          <small>{paymentLabels[item.paymentSituation]}</small>
        </div>
        <div data-open={item.balanceCents > 0}>
          <span>Saldo pendiente</span>
          <strong>{formatMoney(item.balanceCents)}</strong>
          <small>
            {item.dueDate
              ? `${item.overdue ? 'Venció' : 'Vence'} el ${formatDate(item.dueDate)}`
              : 'Sin fecha límite'}
          </small>
        </div>
        <div className={styles.summaryTrack}>
          <span>
            <span style={{ width: `${String(paidPercent)}%` }} />
          </span>
          <small>{paidPercent}% cobrado</small>
        </div>
      </section>

      <SaleActions sale={item} />
      <SaleAdministration sale={item} />

      <div className={styles.detailGrid}>
        <section className={styles.detailCard} aria-labelledby="sale-products-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Composición</p>
              <h2 id="sale-products-title">Productos de la venta</h2>
            </div>
            <span>{deliveryLabels[item.deliverySituation]}</span>
          </div>
          <div className={styles.lineList}>
            {item.lines.map((line) => (
              <SaleLine key={line.id} line={line} />
            ))}
          </div>
        </section>
        <aside className={styles.detailAside}>
          <section className={styles.detailCard} aria-labelledby="customer-title">
            <p className={styles.kicker}>Cliente</p>
            <h2 id="customer-title">Datos de contacto</h2>
            {item.customer ? (
              <dl className={styles.definitionList}>
                <div>
                  <dt>Nombre</dt>
                  <dd>{item.customer.name}</dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>
                    <a href={`tel:${item.customer.phone}`}>{item.customer.phone}</a>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className={styles.muted}>Esta venta no tiene un cliente asociado.</p>
            )}
            {item.paymentAgreementNote ? (
              <div className={styles.agreement}>
                <strong>Acuerdo de pago</strong>
                <p>{item.paymentAgreementNote}</p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      <section
        className={[styles.detailCard, styles.timelineCard].join(' ')}
        aria-labelledby="timeline-title"
      >
        <p className={styles.kicker}>Rastro operativo</p>
        <h2 id="timeline-title">Historia de la venta</h2>
        <ol className={styles.timeline}>
          {eventsFor(item).map((event) => (
            <li key={event.key}>
              <span aria-hidden="true" />
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
                <small>{formatDateTime(event.at)}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function SaleLine({ line }: Readonly<{ line: SaleDetail['lines'][number] }>) {
  const product = productSnapshot(line);
  const delivered = line.deliveryQuantity;
  return (
    <article className={styles.saleLine}>
      <div>
        <span>{product.code}</span>
        <h3>{product.name}</h3>
        <small>{line.locationName}</small>
      </div>
      <dl>
        <div>
          <dt>Cantidad</dt>
          <dd>{line.quantity}</dd>
        </div>
        <div>
          <dt>Entregada</dt>
          <dd>{delivered}</dd>
        </div>
        <div>
          <dt>Reservada</dt>
          <dd>{line.activeReservationQuantity}</dd>
        </div>
        <div>
          <dt>Precio unitario</dt>
          <dd>{formatMoney(line.agreedUnitPriceCents)}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(line.originalSubtotalCents)}</dd>
        </div>
      </dl>
    </article>
  );
}

interface TimelineEvent {
  key: string;
  title: string;
  detail: string;
  at: string;
}
function eventsFor(sale: SaleDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      key: 'created',
      title: 'Venta registrada',
      detail: `Borrador creado por ${sale.creatorUsername}.`,
      at: sale.createdAt,
    },
  ];
  if (sale.confirmedAt)
    events.push({
      key: 'confirmed',
      title: 'Venta confirmada',
      detail: 'Se aplicaron las entregas y reservas iniciales.',
      at: sale.confirmedAt,
    });
  for (const payment of sale.payments)
    events.push({
      key: payment.id,
      title: `Pago de ${formatMoney(payment.amountCents)}`,
      detail: `${paymentMethodLabels[payment.method]} · registrado por ${payment.registrarUsername}.`,
      at: payment.effectiveAt,
    });
  for (const payment of sale.payments)
    for (const correction of correctionEvents(payment.corrections))
      events.push({
        key: correction.id,
        title: `Pago corregido por ${formatMoney(correction.amountCents)}`,
        detail: correction.reason,
        at: correction.effectiveAt,
      });
  for (const adjustment of adjustmentEvents(sale.totalAdjustments))
    events.push({
      key: adjustment.id,
      title: `Total ajustado a ${formatMoney(adjustment.newTotalCents)}`,
      detail: `${adjustment.reason} · diferencia de ${signedMoney(adjustment.differenceCents)}.`,
      at: adjustment.effectiveAt,
    });
  for (const delivery of deliveryEvents(sale.deliveries))
    events.push({
      key: delivery.id,
      title: `${String(delivery.quantity)} ${delivery.quantity === 1 ? 'unidad entregada' : 'unidades entregadas'}`,
      detail: `Entrega registrada por ${delivery.actorUsername}.`,
      at: delivery.effectiveAt,
    });
  for (const saleReturn of returnEvents(sale.returns))
    events.push({
      key: saleReturn.id,
      title: `Devolución por ${formatMoney(saleReturn.commercialReductionCents)}`,
      detail:
        saleReturn.refundAmountCents > 0
          ? `${saleReturn.reason} · reembolso de ${formatMoney(saleReturn.refundAmountCents)}.`
          : `${saleReturn.reason} · sin reembolso.`,
      at: saleReturn.effectiveAt,
    });
  const closure = closureEvent(sale.closure);
  if (closure !== null)
    events.push({
      key: closure.id,
      title:
        closure.type === 'complete'
          ? 'Venta finalizada como completa'
          : 'Venta finalizada incompleta',
      detail:
        closure.forgivenAmountCents > 0
          ? `${formatMoney(closure.forgivenAmountCents)} quedaron sin cobrar${closure.reason === null ? '.' : ` · ${closure.reason}`}`
          : 'El acuerdo quedó completo.',
      at: closure.effectiveAt,
    });
  const cancellation = cancellationEvent(sale.cancellation);
  if (cancellation !== null)
    events.push({
      key: cancellation.id,
      title: 'Venta cancelada',
      detail:
        cancellation.refundAmountCents > 0
          ? `${cancellation.reason} · reembolso de ${formatMoney(cancellation.refundAmountCents)}.`
          : `${cancellation.reason} · sin reembolso.`,
      at: cancellation.effectiveAt,
    });
  return events.toSorted((left, right) => left.at.localeCompare(right.at));
}

function adjustmentEvents(values: SaleDetail['totalAdjustments']): {
  id: string;
  newTotalCents: number;
  differenceCents: number;
  reason: string;
  effectiveAt: string;
}[] {
  return values.flatMap((value) => {
    const candidate: unknown = value;
    return isRecord(candidate) &&
      typeof candidate.id === 'string' &&
      typeof candidate.newTotalCents === 'number' &&
      typeof candidate.differenceCents === 'number' &&
      typeof candidate.reason === 'string' &&
      typeof candidate.effectiveAt === 'string'
      ? [
          {
            id: candidate.id,
            newTotalCents: candidate.newTotalCents,
            differenceCents: candidate.differenceCents,
            reason: candidate.reason,
            effectiveAt: candidate.effectiveAt,
          },
        ]
      : [];
  });
}

function cancellationEvent(value: SaleDetail['cancellation']): {
  id: string;
  reason: string;
  refundAmountCents: number;
  effectiveAt: string;
} | null {
  const candidate: unknown = value;
  if (
    !isRecord(candidate) ||
    typeof candidate.id !== 'string' ||
    typeof candidate.reason !== 'string' ||
    typeof candidate.refundAmountCents !== 'number' ||
    typeof candidate.effectiveAt !== 'string'
  )
    return null;
  return {
    id: candidate.id,
    reason: candidate.reason,
    refundAmountCents: candidate.refundAmountCents,
    effectiveAt: candidate.effectiveAt,
  };
}

function signedMoney(cents: number): string {
  return `${cents >= 0 ? '+' : '−'}${formatMoney(Math.abs(cents))}`;
}

function correctionEvents(values: SaleDetail['payments'][number]['corrections']): {
  id: string;
  amountCents: number;
  reason: string;
  effectiveAt: string;
}[] {
  return values.flatMap((value) => {
    const candidate: unknown = value;
    return isRecord(candidate) &&
      typeof candidate.id === 'string' &&
      typeof candidate.amountCents === 'number' &&
      typeof candidate.reason === 'string' &&
      typeof candidate.effectiveAt === 'string'
      ? [
          {
            id: candidate.id,
            amountCents: candidate.amountCents,
            reason: candidate.reason,
            effectiveAt: candidate.effectiveAt,
          },
        ]
      : [];
  });
}

function returnEvents(values: SaleDetail['returns']): {
  id: string;
  reason: string;
  commercialReductionCents: number;
  refundAmountCents: number;
  effectiveAt: string;
}[] {
  return values.flatMap((value) => {
    const candidate: unknown = value;
    return isRecord(candidate) &&
      typeof candidate.id === 'string' &&
      typeof candidate.reason === 'string' &&
      typeof candidate.commercialReductionCents === 'number' &&
      typeof candidate.refundAmountCents === 'number' &&
      typeof candidate.effectiveAt === 'string'
      ? [
          {
            id: candidate.id,
            reason: candidate.reason,
            commercialReductionCents: candidate.commercialReductionCents,
            refundAmountCents: candidate.refundAmountCents,
            effectiveAt: candidate.effectiveAt,
          },
        ]
      : [];
  });
}

function closureEvent(value: SaleDetail['closure']): {
  id: string;
  type: 'complete' | 'incomplete';
  forgivenAmountCents: number;
  reason: string | null;
  effectiveAt: string;
} | null {
  const candidate: unknown = value;
  if (
    !isRecord(candidate) ||
    typeof candidate.id !== 'string' ||
    (candidate.type !== 'complete' && candidate.type !== 'incomplete') ||
    typeof candidate.forgivenAmountCents !== 'number' ||
    (candidate.reason !== null && typeof candidate.reason !== 'string') ||
    typeof candidate.effectiveAt !== 'string'
  )
    return null;
  return {
    id: candidate.id,
    type: candidate.type,
    forgivenAmountCents: candidate.forgivenAmountCents,
    reason: candidate.reason,
    effectiveAt: candidate.effectiveAt,
  };
}

function deliveryEvents(values: SaleDetail['deliveries']): {
  id: string;
  actorUsername: string;
  effectiveAt: string;
  quantity: number;
}[] {
  return values.flatMap((value) => {
    const candidate: unknown = value;
    if (!isRecord(candidate)) return [];
    const lines = Array.isArray(candidate.lines) ? candidate.lines : [];
    const quantity = lines.reduce(
      (total: number, line: unknown) =>
        total + (isRecord(line) && typeof line.quantity === 'number' ? line.quantity : 0),
      0,
    );
    return typeof candidate.id === 'string' &&
      typeof candidate.actorUsername === 'string' &&
      typeof candidate.effectiveAt === 'string'
      ? [
          {
            id: candidate.id,
            actorUsername: candidate.actorUsername,
            effectiveAt: candidate.effectiveAt,
            quantity,
          },
        ]
      : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function BackLink() {
  return (
    <Link className={styles.backLink} href="/sales">
      <Icon name="arrow" /> Volver a ventas
    </Link>
  );
}
function Feedback({
  title,
  detail,
  retry,
}: Readonly<{ title: string; detail: string; retry?: () => void }>) {
  return (
    <div className={styles.feedback} role="alert">
      <strong>{title}</strong>
      <p>{detail}</p>
      {retry ? (
        <button type="button" onClick={retry}>
          Intentar nuevamente
        </button>
      ) : null}
    </div>
  );
}
function DetailSkeleton() {
  return (
    <div className={styles.detailPage} aria-label="Cargando venta">
      <div className={styles.detailSkeleton} />
      <div className={styles.detailSkeletonGrid}>
        <div />
        <div />
      </div>
    </div>
  );
}
