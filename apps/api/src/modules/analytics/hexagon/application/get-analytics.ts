import type {
  AnalyticsPaymentMethod,
  AnalyticsSource,
  CashMovementCause,
  ProductPerformanceFilter,
  ProductPerformanceFact,
  ResultFacts,
} from './analytics.source';
import { reportingMonthInLima } from '../domain/reporting-period';

export interface CashFlowReport {
  readonly month: string;
  readonly inflowCents: number;
  readonly outflowCents: number;
  readonly netCashFlowCents: number;
  readonly byMethod: readonly CashFlowBreakdown[];
  readonly byCause: readonly CashFlowCauseBreakdown[];
}
export interface CashFlowBreakdown {
  readonly method: AnalyticsPaymentMethod;
  readonly inflowCents: number;
  readonly outflowCents: number;
  readonly netCents: number;
}
export interface CashFlowCauseBreakdown {
  readonly cause: CashMovementCause;
  readonly inflowCents: number;
  readonly outflowCents: number;
  readonly netCents: number;
}

export class GetCashFlow {
  constructor(private readonly source: AnalyticsSource) {}

  async execute(month: string): Promise<CashFlowReport> {
    const period = reportingMonthInLima(month);
    const facts = await this.source.cashMovements(period);
    const byMethod = (['cash', 'yape', 'plin', 'pos'] as const).map((method) =>
      breakdown(
        method,
        facts.filter((fact) => fact.method === method),
      ),
    );
    const causes = [...new Set(facts.map(({ cause }) => cause))].sort();
    const byCause = causes.map((cause) => ({
      cause,
      ...totals(facts.filter((fact) => fact.cause === cause)),
    }));
    const total = totals(facts);
    return {
      month,
      inflowCents: total.inflowCents,
      outflowCents: total.outflowCents,
      netCashFlowCents: total.netCents,
      byMethod,
      byCause,
    };
  }
}

export interface MonthlyResultReport extends ResultFacts {
  readonly month: string;
  readonly netSalesCents: number;
  readonly netSaleCostCents: number;
  readonly grossMarginCents: number;
  readonly totalLossesCents: number;
  readonly estimatedResultCents: number;
}

export class GetMonthlyResult {
  constructor(private readonly source: AnalyticsSource) {}

  async execute(month: string): Promise<MonthlyResultReport> {
    const facts = await this.source.resultFacts(reportingMonthInLima(month));
    const netSalesCents = safeAdd(
      safeAdd(
        safeAdd(facts.confirmedSalesCents, facts.saleAdjustmentsCents),
        -facts.returnReductionsCents,
      ),
      -facts.cancellationRefundsCents,
    );
    const netSaleCostCents = safeAdd(facts.saleCostCents, -facts.returnedCostCents);
    const grossMarginCents = safeAdd(netSalesCents, -netSaleCostCents);
    const totalLossesCents = safeAdd(
      safeAdd(facts.inventoryWriteOffLossCents, facts.supplierAdvanceLossCents),
      facts.forgivenBalanceCents,
    );
    return {
      month,
      ...facts,
      netSalesCents,
      netSaleCostCents,
      grossMarginCents,
      totalLossesCents,
      estimatedResultCents: safeAdd(
        safeAdd(grossMarginCents, -facts.operatingExpensesCents),
        -totalLossesCents,
      ),
    };
  }
}

export interface UserPerformanceReport {
  readonly month: string;
  readonly items: readonly (Awaited<ReturnType<AnalyticsSource['userPerformance']>>[number] & {
    readonly averageSaleTicketCents: number | null;
  })[];
}

export class GetUserPerformance {
  constructor(private readonly source: AnalyticsSource) {}

  async execute(month: string): Promise<UserPerformanceReport> {
    const items = await this.source.userPerformance(reportingMonthInLima(month));
    return {
      month,
      items: items.map((item) => ({
        ...item,
        averageSaleTicketCents:
          item.salesCount === 0 ? null : Math.round(item.salesAmountCents / item.salesCount),
      })),
    };
  }
}

export type ProductPerformanceSort = 'margin-desc' | 'units-desc' | 'availability-asc';
export interface ProductPerformanceItem extends ProductPerformanceFact {
  readonly netUnitsSold: number;
  readonly netSalesCents: number;
  readonly netCostCents: number;
  readonly grossMarginCents: number;
  readonly marginBasisPoints: number | null;
  readonly physicalQuantity: number;
  readonly reservedQuantity: number;
  readonly reviewQuantity: number;
  readonly availableQuantity: number;
}
export interface ProductPerformanceReport {
  readonly month: string;
  readonly sort: ProductPerformanceSort;
  readonly items: readonly ProductPerformanceItem[];
}

export class GetProductPerformance {
  constructor(private readonly source: AnalyticsSource) {}

  async execute(input: {
    month: string;
    categoryId?: string;
    productId?: string;
    sort: ProductPerformanceSort;
    limit: number;
  }): Promise<ProductPerformanceReport> {
    const filter: ProductPerformanceFilter = {
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.productId === undefined ? {} : { productId: input.productId }),
    };
    const facts = await this.source.productPerformance(reportingMonthInLima(input.month), filter);
    const items = facts.map(toProductItem).sort(sortProducts(input.sort)).slice(0, input.limit);
    return { month: input.month, sort: input.sort, items };
  }
}

function breakdown(
  method: AnalyticsPaymentMethod,
  facts: readonly { direction: 'inflow' | 'outflow'; amountCents: number }[],
): CashFlowBreakdown {
  return { method, ...totals(facts) };
}
function totals(facts: readonly { direction: 'inflow' | 'outflow'; amountCents: number }[]) {
  let inflowCents = 0;
  let outflowCents = 0;
  for (const fact of facts) {
    if (fact.direction === 'inflow') inflowCents = safeAdd(inflowCents, fact.amountCents);
    else outflowCents = safeAdd(outflowCents, fact.amountCents);
  }
  return { inflowCents, outflowCents, netCents: safeAdd(inflowCents, -outflowCents) };
}
function toProductItem(fact: ProductPerformanceFact): ProductPerformanceItem {
  const netSalesCents = safeAdd(fact.grossSalesCents, -fact.returnReductionsCents);
  const netCostCents = safeAdd(fact.saleCostCents, -fact.returnedCostCents);
  const grossMarginCents = safeAdd(netSalesCents, -netCostCents);
  const quantities = fact.stockByLocation.reduce(
    (result, position) => ({
      physical: result.physical + position.physicalQuantity,
      reserved: result.reserved + position.reservedQuantity,
      review: result.review + position.reviewQuantity,
    }),
    { physical: 0, reserved: 0, review: 0 },
  );
  return {
    ...fact,
    netUnitsSold: fact.soldUnits - fact.returnedUnits,
    netSalesCents,
    netCostCents,
    grossMarginCents,
    marginBasisPoints:
      netSalesCents <= 0 ? null : roundedRatioBasisPoints(grossMarginCents, netSalesCents),
    physicalQuantity: quantities.physical,
    reservedQuantity: quantities.reserved,
    reviewQuantity: quantities.review,
    availableQuantity: quantities.physical - quantities.reserved - quantities.review,
  };
}
function sortProducts(sort: ProductPerformanceSort) {
  return (left: ProductPerformanceItem, right: ProductPerformanceItem): number => {
    const comparison =
      sort === 'margin-desc'
        ? compareDescending(left.grossMarginCents, right.grossMarginCents)
        : sort === 'units-desc'
          ? compareDescending(left.netUnitsSold, right.netUnitsSold)
          : compareAscending(left.availableQuantity, right.availableQuantity);
    return comparison === 0 ? left.code.localeCompare(right.code) : comparison;
  };
}
function compareDescending(left: number, right: number): number {
  return left === right ? 0 : left > right ? -1 : 1;
}
function compareAscending(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}
function roundedRatioBasisPoints(numeratorCents: number, denominatorCents: number): number {
  const numerator = BigInt(numeratorCents) * 10_000n;
  const denominator = BigInt(denominatorCents);
  const rounded =
    numerator >= 0n
      ? (numerator + denominator / 2n) / denominator
      : (numerator - denominator / 2n) / denominator;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error('Analytics ratio exceeds the safe range.');
  return result;
}
function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error('Analytics total exceeds the safe range.');
  return result;
}
