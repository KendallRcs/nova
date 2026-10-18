import type { PaymentMethod } from '../../../sales/hexagon/domain/sale';
import {
  deriveSaleTracking,
  type DeliverySituation,
  type TrackedPaymentSituation,
} from '../../../sales/hexagon/domain/sale-tracking';
import type { CustomerClock } from './customer.dependencies';

export interface CustomerAccountRecord {
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly phone: string;
    readonly dni: string | null;
    readonly address: string | null;
    readonly mergedCustomerIds: readonly string[];
  };
  readonly sales: readonly CustomerAccountSaleRecord[];
}

export interface CustomerAccountSaleRecord {
  readonly id: string;
  readonly createdBy: string;
  readonly creatorUsername: string;
  readonly lifecycle: 'confirmed' | 'finalized' | 'cancelled';
  readonly originalTotalCents: number;
  readonly currentTotalCents: number;
  readonly dueDate: string | null;
  readonly paymentAmountsCents: readonly number[];
  readonly refundAmountsCents: readonly number[];
  readonly forgivenAmountCents: number;
  readonly lines: readonly { quantity: number; deliveredQuantity: number }[];
  readonly payments: readonly {
    readonly id: string;
    readonly amountCents: number;
    readonly correctedCents: number;
    readonly netAmountCents: number;
    readonly method: PaymentMethod;
    readonly registeredBy: string;
    readonly registrarUsername: string;
    readonly effectiveAt: Date;
  }[];
  readonly confirmedAt: Date;
  readonly finalizedAt: Date | null;
  readonly cancelledAt: Date | null;
}

export interface CustomerAccountSource {
  findByCustomerId(customerId: string): Promise<CustomerAccountRecord | null>;
}

export interface CustomerAccountSale {
  readonly id: string;
  readonly createdBy: string;
  readonly creatorUsername: string;
  readonly lifecycle: CustomerAccountSaleRecord['lifecycle'];
  readonly originalTotalCents: number;
  readonly currentTotalCents: number;
  readonly paidCents: number;
  readonly refundedCents: number;
  readonly forgivenAmountCents: number;
  readonly balanceCents: number;
  readonly paymentSituation: TrackedPaymentSituation;
  readonly deliverySituation: DeliverySituation;
  readonly overdue: boolean;
  readonly dueDate: string | null;
  readonly lastPaymentAt: Date | null;
  readonly payments: CustomerAccountSaleRecord['payments'];
  readonly confirmedAt: Date;
  readonly finalizedAt: Date | null;
  readonly cancelledAt: Date | null;
}

export interface CustomerAccount {
  readonly customer: CustomerAccountRecord['customer'];
  readonly summary: {
    readonly salesCount: number;
    readonly activeDebtSalesCount: number;
    readonly overdueSalesCount: number;
    readonly totalPaidCents: number;
    readonly totalOutstandingCents: number;
    readonly overdueAmountCents: number;
    readonly nearestDueDate: string | null;
    readonly lastPaymentAt: Date | null;
  };
  readonly sales: readonly CustomerAccountSale[];
}

export type GetCustomerAccountResult =
  | { readonly ok: true; readonly account: CustomerAccount }
  | { readonly ok: false; readonly reason: 'customer-not-found' };

export class GetCustomerAccount {
  constructor(
    private readonly source: CustomerAccountSource,
    private readonly clock: CustomerClock,
  ) {}

  async execute(customerId: string): Promise<GetCustomerAccountResult> {
    const record = await this.source.findByCustomerId(customerId);
    if (record === null) return { ok: false, reason: 'customer-not-found' };
    const todayInLima = limaCivilDate(this.clock.now());
    const sales = record.sales.map((sale) => toSale(sale, todayInLima));
    const activeDebts = sales.filter(
      (sale) =>
        sale.lifecycle === 'confirmed' &&
        (sale.paymentSituation === 'unpaid' || sale.paymentSituation === 'partial') &&
        sale.balanceCents > 0,
    );
    return {
      ok: true,
      account: {
        customer: record.customer,
        summary: {
          salesCount: sales.length,
          activeDebtSalesCount: activeDebts.length,
          overdueSalesCount: activeDebts.filter(({ overdue }) => overdue).length,
          totalPaidCents: safeSum(sales.map(({ paidCents }) => paidCents)),
          totalOutstandingCents: safeSum(activeDebts.map(({ balanceCents }) => balanceCents)),
          overdueAmountCents: safeSum(
            activeDebts.filter(({ overdue }) => overdue).map(({ balanceCents }) => balanceCents),
          ),
          nearestDueDate:
            activeDebts
              .map(({ dueDate }) => dueDate)
              .filter((dueDate): dueDate is string => dueDate !== null)
              .sort()[0] ?? null,
          lastPaymentAt: latestDate(sales.map(({ lastPaymentAt }) => lastPaymentAt)),
        },
        sales,
      },
    };
  }
}

function toSale(record: CustomerAccountSaleRecord, todayInLima: string): CustomerAccountSale {
  const tracking = deriveSaleTracking({
    lifecycle: record.lifecycle,
    currentTotalCents: record.currentTotalCents,
    paymentAmountsCents: record.paymentAmountsCents,
    refundAmountsCents: record.refundAmountsCents,
    forgivenAmountCents: record.forgivenAmountCents,
    lineQuantities: record.lines,
    dueDate: record.dueDate,
    todayInLima,
  });
  return {
    id: record.id,
    createdBy: record.createdBy,
    creatorUsername: record.creatorUsername,
    lifecycle: record.lifecycle,
    originalTotalCents: record.originalTotalCents,
    currentTotalCents: record.currentTotalCents,
    ...tracking,
    refundedCents: safeSum(record.refundAmountsCents),
    forgivenAmountCents: record.forgivenAmountCents,
    dueDate: record.dueDate,
    lastPaymentAt: latestDate(record.payments.map(({ effectiveAt }) => effectiveAt)),
    payments: record.payments,
    confirmedAt: record.confirmedAt,
    finalizedAt: record.finalizedAt,
    cancelledAt: record.cancelledAt,
  };
}

function latestDate(values: readonly (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const value of values) {
    if (value !== null && (latest === null || value.getTime() > latest.getTime())) latest = value;
  }
  return latest;
}

function safeSum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('Invalid customer account value.');
    total += value;
    if (!Number.isSafeInteger(total)) throw new Error('Customer account total exceeds safe range.');
  }
  return total;
}

function limaCivilDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
