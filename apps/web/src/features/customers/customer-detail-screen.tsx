'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';

import { ApiProblem, problemMessage } from '@/shared/api/problem-details';
import { formatDate, formatDateTime, formatMoney } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import { customerAccountQueryKey, getCustomerAccount, type CustomerAccount } from './customers-api';
import styles from './customers.module.css';

export function CustomerDetailScreen({ customerId }: Readonly<{ customerId: string }>) {
  const account = useQuery({
    queryKey: customerAccountQueryKey(customerId),
    queryFn: () => getCustomerAccount(customerId),
  });
  if (account.isPending) return <DetailSkeleton />;
  if (account.isError) {
    const unavailable =
      account.error instanceof ApiProblem && [403, 404].includes(account.error.problem.status);
    return (
      <div className={styles.detailPage}>
        <BackLink />
        <Feedback
          title={unavailable ? 'Este cliente no está disponible' : 'No pudimos cargar la cuenta'}
          detail={
            unavailable
              ? 'Vuelve al directorio y selecciona otro cliente.'
              : problemMessage(account.error)
          }
          {...(unavailable ? {} : { action: 'Intentar nuevamente' })}
          onAction={() => {
            void account.refetch();
          }}
        />
      </div>
    );
  }
  const { customer, summary, sales } = account.data;
  return (
    <div className={styles.detailPage}>
      <BackLink />
      <header className={styles.customerHeader}>
        <span className={styles.largeAvatar} aria-hidden="true">
          {initials(customer.name)}
        </span>
        <div>
          <p className={styles.kicker}>Cuenta del cliente</p>
          <h1>{customer.name}</h1>
          <p>
            {customer.dni ? `DNI ${customer.dni}` : 'Sin DNI registrado'}
            {customer.mergedCustomerIds.length > 0
              ? ` · ${String(customer.mergedCustomerIds.length)} identidades consolidadas`
              : ''}
          </p>
        </div>
        <a className={styles.callButton} href={`tel:${customer.phone}`}>
          Llamar al {customer.phone}
        </a>
      </header>

      <section className={styles.accountStrip} aria-label="Resumen de cuenta">
        <div data-alert={summary.totalOutstandingCents > 0}>
          <span>Saldo pendiente</span>
          <strong>{formatMoney(summary.totalOutstandingCents)}</strong>
          <small>
            {summary.activeDebtSalesCount}{' '}
            {summary.activeDebtSalesCount === 1 ? 'venta abierta' : 'ventas abiertas'}
          </small>
        </div>
        <div data-alert={summary.overdueAmountCents > 0}>
          <span>Monto atrasado</span>
          <strong>{formatMoney(summary.overdueAmountCents)}</strong>
          <small>
            {summary.overdueSalesCount}{' '}
            {summary.overdueSalesCount === 1 ? 'venta atrasada' : 'ventas atrasadas'}
          </small>
        </div>
        <div>
          <span>Total pagado</span>
          <strong>{formatMoney(summary.totalPaidCents)}</strong>
          <small>
            {summary.lastPaymentAt
              ? `Último pago ${formatDate(summary.lastPaymentAt)}`
              : 'Sin pagos registrados'}
          </small>
        </div>
        <div>
          <span>Próximo vencimiento</span>
          <strong>
            {summary.nearestDueDate ? formatDate(summary.nearestDueDate) : 'Sin fecha'}
          </strong>
          <small>
            {summary.nearestDueDate ? 'Entre las deudas activas' : 'No hay vencimientos activos'}
          </small>
        </div>
      </section>

      <div className={styles.accountLayout}>
        <section className={styles.accountHistory} aria-labelledby="customer-history-title">
          <header>
            <div>
              <p className={styles.kicker}>Historial consolidado</p>
              <h2 id="customer-history-title">Ventas y pagos</h2>
            </div>
            <span>
              {sales.length} {sales.length === 1 ? 'operación' : 'operaciones'}
            </span>
          </header>
          {sales.length === 0 ? (
            <div className={styles.emptyHistory}>
              <strong>Este cliente aún no tiene ventas</strong>
              <p>Sus próximas operaciones aparecerán aquí con pagos, saldos y vencimientos.</p>
            </div>
          ) : (
            sales.map((sale) => <AccountSale key={sale.id} sale={sale} />)
          )}
        </section>
        <aside className={styles.contactCard}>
          <p className={styles.kicker}>Contacto</p>
          <h2>Datos vigentes</h2>
          <dl>
            <div>
              <dt>Teléfono</dt>
              <dd>
                <a href={`tel:${customer.phone}`}>{customer.phone}</a>
              </dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{customer.address ?? 'No registrada'}</dd>
            </div>
            <div>
              <dt>DNI</dt>
              <dd>{customer.dni ?? 'No registrado'}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function AccountSale({ sale }: Readonly<{ sale: CustomerAccount['sales'][number] }>) {
  return (
    <article className={styles.accountSale}>
      <Link href={`/sales/${sale.id}` as Route}>
        <span>
          <strong>Venta V-{sale.id.slice(-8).toUpperCase()}</strong>
          <small>
            {formatDate(sale.confirmedAt)} · por {sale.creatorUsername}
          </small>
        </span>
        <span className={styles.saleState} data-overdue={sale.overdue}>
          {sale.overdue ? 'Pago atrasado' : paymentLabel(sale.paymentSituation)}
        </span>
        <span>
          <small>Total</small>
          <strong>{formatMoney(sale.currentTotalCents)}</strong>
        </span>
        <span data-balance={sale.balanceCents > 0}>
          <small>Saldo</small>
          <strong>{formatMoney(sale.balanceCents)}</strong>
        </span>
        <Icon name="arrow" />
      </Link>
      {sale.payments.length > 0 ? (
        <details>
          <summary>
            {sale.payments.length}{' '}
            {sale.payments.length === 1 ? 'pago registrado' : 'pagos registrados'}
          </summary>
          <ul>
            {sale.payments.map((payment) => (
              <li key={payment.id}>
                <span>
                  {formatDateTime(payment.effectiveAt)} · {methodLabel(payment.method)} ·{' '}
                  {payment.registrarUsername}
                </span>
                <strong>{formatMoney(payment.netAmountCents)}</strong>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function BackLink() {
  return (
    <Link className={styles.backLink} href="/customers">
      <Icon name="arrow" /> Volver a clientes
    </Link>
  );
}
function Feedback({
  title,
  detail,
  action,
  onAction,
}: Readonly<{ title: string; detail: string; action?: string; onAction: () => void }>) {
  return (
    <div className={styles.feedback}>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}
function DetailSkeleton() {
  return (
    <div className={styles.detailPage} aria-label="Cargando cuenta del cliente">
      <div className={styles.detailSkeleton} />
      <div className={styles.detailSkeletonGrid}>
        <span />
        <span />
      </div>
    </div>
  );
}
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
function paymentLabel(value: CustomerAccount['sales'][number]['paymentSituation']): string {
  return value === 'paid'
    ? 'Pagada'
    : value === 'partial'
      ? 'Pago parcial'
      : value === 'unpaid'
        ? 'Sin pagos'
        : value === 'closed-with-balance'
          ? 'Finalizada incompleta'
          : 'Sin cobro aplicable';
}
function methodLabel(
  value: CustomerAccount['sales'][number]['payments'][number]['method'],
): string {
  return value === 'cash'
    ? 'Efectivo'
    : value === 'yape'
      ? 'Yape'
      : value === 'plin'
        ? 'Plin'
        : 'POS';
}
