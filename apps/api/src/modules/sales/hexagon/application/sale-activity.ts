import type { SaleClock } from './sale.dependencies';
import type { SaleLifecycle } from '../domain/sale';
import {
  deriveSaleTracking,
  type DeliverySituation,
  type TrackedPaymentSituation,
} from '../domain/sale-tracking';

export type SaleDebtFilter = 'all' | 'pending' | 'paid' | 'overdue';

export interface SaleActivityRecord {
  readonly id: string;
  readonly createdBy: string;
  readonly creatorUsername: string;
  readonly customer: {
    readonly historicalId: string;
    readonly canonicalId: string;
    readonly name: string;
    readonly phone: string;
  } | null;
  readonly lifecycle: SaleLifecycle;
  readonly originalTotalCents: number;
  readonly currentTotalCents: number;
  readonly dueDate: string | null;
  readonly paymentAmountsCents: readonly number[];
  readonly forgivenAmountCents: number;
  readonly lines: readonly { quantity: number; deliveredQuantity: number }[];
  readonly version: number;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SaleActivityItem {
  readonly id: string;
  readonly createdBy: string;
  readonly creatorUsername: string;
  readonly customer: SaleActivityRecord['customer'];
  readonly lifecycle: SaleLifecycle;
  readonly originalTotalCents: number;
  readonly currentTotalCents: number;
  readonly paidCents: number;
  readonly balanceCents: number;
  readonly paymentSituation: TrackedPaymentSituation;
  readonly deliverySituation: DeliverySituation;
  readonly overdue: boolean;
  readonly dueDate: string | null;
  readonly version: number;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SaleActivityPage {
  readonly items: readonly SaleActivityItem[];
  readonly nextSaleId: string | null;
}

export interface SaleActivitySource {
  find(input: {
    createdBy?: string;
    customerId?: string;
    lifecycle?: SaleLifecycle;
  }): Promise<readonly SaleActivityRecord[]>;
}

export class ListSales {
  constructor(
    private readonly source: SaleActivitySource,
    private readonly clock: SaleClock,
  ) {}

  async execute(input: {
    actorId: string;
    canReadAny: boolean;
    createdBy?: string;
    customerId?: string;
    lifecycle?: SaleLifecycle;
    debt: SaleDebtFilter;
    afterSaleId?: string;
    limit: number;
  }): Promise<SaleActivityPage> {
    const createdBy = input.canReadAny ? input.createdBy : input.actorId;
    const records = await this.source.find({
      ...(createdBy === undefined ? {} : { createdBy }),
      ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
      ...(input.lifecycle === undefined ? {} : { lifecycle: input.lifecycle }),
    });
    const todayInLima = limaCivilDate(this.clock.now());
    const items = records
      .map((record) => toItem(record, todayInLima))
      .filter((item) => matchesDebt(item, input.debt));
    const cursorIndex =
      input.afterSaleId === undefined ? -1 : items.findIndex(({ id }) => id === input.afterSaleId);
    const pageStart =
      input.afterSaleId === undefined ? 0 : cursorIndex < 0 ? items.length : cursorIndex + 1;
    const selected = items.slice(pageStart, pageStart + input.limit + 1);
    const hasNextPage = selected.length > input.limit;
    const page = selected.slice(0, input.limit);
    return {
      items: page,
      nextSaleId: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    };
  }
}

function toItem(record: SaleActivityRecord, todayInLima: string): SaleActivityItem {
  const tracking = deriveSaleTracking({
    lifecycle: record.lifecycle,
    currentTotalCents: record.currentTotalCents,
    paymentAmountsCents: record.paymentAmountsCents,
    forgivenAmountCents: record.forgivenAmountCents,
    lineQuantities: record.lines,
    dueDate: record.dueDate,
    todayInLima,
  });
  return {
    id: record.id,
    createdBy: record.createdBy,
    creatorUsername: record.creatorUsername,
    customer: record.customer,
    lifecycle: record.lifecycle,
    originalTotalCents: record.originalTotalCents,
    currentTotalCents: record.currentTotalCents,
    ...tracking,
    dueDate: record.dueDate,
    version: record.version,
    confirmedAt: record.confirmedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function matchesDebt(item: SaleActivityItem, debt: SaleDebtFilter): boolean {
  if (debt === 'all') return true;
  if (debt === 'overdue') return item.overdue;
  if (debt === 'paid') return item.paymentSituation === 'paid';
  return (
    (item.paymentSituation === 'unpaid' || item.paymentSituation === 'partial') &&
    item.balanceCents > 0
  );
}

export function limaCivilDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
