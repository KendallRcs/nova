'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { problemMessage } from '@/shared/api/problem-details';
import { formatDateTime, formatMoney } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import { getPurchaseDetail, paymentMethodLabels, purchaseDetailQueryKey } from './procurement-api';
import styles from './purchase-detail.module.css';

export function PurchaseDetailScreen({ purchaseId }: Readonly<{ purchaseId: string }>) {
  const purchase = useQuery({
    queryKey: purchaseDetailQueryKey(purchaseId),
    queryFn: () => getPurchaseDetail(purchaseId),
  });
  if (purchase.isPending) return <div className={styles.skeleton} aria-label="Cargando compra" />;
  if (purchase.isError)
    return (
      <div className={styles.feedback}>
        <strong>No pudimos cargar la compra</strong>
        <p>{problemMessage(purchase.error)}</p>
      </div>
    );
  const value = purchase.data;
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/purchases">
        <Icon name="arrow" /> Volver a compras
      </Link>
      <header>
        <div>
          <p>Compra confirmada</p>
          <h1>{value.supplier.name}</h1>
          <span>
            {formatDateTime(value.effectiveAt)} · por {value.confirmerUsername}
          </span>
        </div>
        <strong>{formatMoney(value.totalCents)}</strong>
      </header>
      <section className={styles.summary} aria-label="Resumen de compra">
        <div>
          <span>Total</span>
          <strong>{formatMoney(value.totalCents)}</strong>
        </div>
        <div>
          <span>Anticipos aplicados</span>
          <strong>{formatMoney(value.advanceAppliedCents)}</strong>
        </div>
        <div>
          <span>Pagado al confirmar</span>
          <strong>{formatMoney(value.newlyPaidCents)}</strong>
          <small>
            {value.paymentMethod
              ? paymentMethodLabels[value.paymentMethod]
              : 'Cubierto con anticipos'}
          </small>
        </div>
        <div>
          <span>Unidades recibidas</span>
          <strong>{value.totalQuantity}</strong>
        </div>
      </section>
      <section className={styles.lines}>
        <header>
          <div>
            <p>Ingreso de inventario</p>
            <h2>Productos y costos</h2>
          </div>
          <span>{value.lines.length} líneas</span>
        </header>
        {value.lines.map((line) => (
          <article key={line.id}>
            <span>
              <strong>{line.currentProductName}</strong>
              <small>
                {line.currentProductCode} · {line.destinationLocationName}
              </small>
            </span>
            <span>
              <small>Cantidad</small>
              <strong>{line.quantity}</strong>
            </span>
            <span>
              <small>Costo unitario</small>
              <strong>{formatMoney(line.unitCostCents)}</strong>
            </span>
            <span>
              <small>Nuevo promedio</small>
              <strong>{formatMoney(line.resultingAverageUnitCostCents)}</strong>
            </span>
            <span>
              <small>Subtotal</small>
              <strong>{formatMoney(line.subtotalCents)}</strong>
            </span>
            {line.priceReviewSuggested ? <b>Revisar precios</b> : null}
          </article>
        ))}
      </section>
      {value.advanceApplications.length > 0 ? (
        <section className={styles.applications}>
          <h2>Anticipos aplicados</h2>
          {value.advanceApplications.map((application) => (
            <div key={application.id}>
              <span>Anticipo …{application.advanceId.slice(-6)}</span>
              <strong>{formatMoney(application.amountCents)}</strong>
              <small>Saldo restante {formatMoney(application.resultingBalanceCents)}</small>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
