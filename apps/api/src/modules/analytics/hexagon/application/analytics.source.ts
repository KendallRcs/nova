import type { ReportingPeriod } from '../domain/reporting-period';

export type AnalyticsPaymentMethod = 'cash' | 'yape' | 'plin' | 'pos';
export type CashMovementCause =
  | 'sale-payment'
  | 'payment-correction'
  | 'sale-return-refund'
  | 'sale-cancellation-refund'
  | 'supplier-advance'
  | 'supplier-refund'
  | 'purchase'
  | 'operating-expense'
  | 'expense-refund';

export interface CashMovementFact {
  readonly direction: 'inflow' | 'outflow';
  readonly amountCents: number;
  readonly method: AnalyticsPaymentMethod;
  readonly cause: CashMovementCause;
}

export interface ResultFacts {
  readonly confirmedSalesCents: number;
  readonly saleAdjustmentsCents: number;
  readonly returnReductionsCents: number;
  readonly cancellationRefundsCents: number;
  readonly saleCostCents: number;
  readonly returnedCostCents: number;
  readonly operatingExpensesCents: number;
  readonly inventoryWriteOffLossCents: number;
  readonly supplierAdvanceLossCents: number;
  readonly forgivenBalanceCents: number;
  readonly soldUnits: number;
  readonly returnedUnits: number;
  readonly writtenOffUnits: number;
}

export interface UserPerformanceFact {
  readonly userId: string;
  readonly username: string;
  readonly accountStatus: 'active' | 'inactive' | 'password-change-required';
  readonly salesCount: number;
  readonly salesAmountCents: number;
  readonly paymentsCount: number;
  readonly paymentsAmountCents: number;
  readonly administrativeOperationsCount: number;
  readonly administrativeAmountCents: number;
}

export interface ProductPerformanceFact {
  readonly productId: string;
  readonly code: string;
  readonly name: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly productStatus: 'active' | 'inactive';
  readonly soldUnits: number;
  readonly returnedUnits: number;
  readonly grossSalesCents: number;
  readonly returnReductionsCents: number;
  readonly saleCostCents: number;
  readonly returnedCostCents: number;
  readonly stockByLocation: readonly {
    readonly locationId: string;
    readonly locationName: string;
    readonly locationType: 'store' | 'warehouse';
    readonly physicalQuantity: number;
    readonly reservedQuantity: number;
    readonly reviewQuantity: number;
  }[];
}

export interface ProductPerformanceFilter {
  readonly categoryId?: string;
  readonly productId?: string;
}

export interface AnalyticsSource {
  cashMovements(period: ReportingPeriod): Promise<readonly CashMovementFact[]>;
  resultFacts(period: ReportingPeriod): Promise<ResultFacts>;
  userPerformance(period: ReportingPeriod): Promise<readonly UserPerformanceFact[]>;
  productPerformance(
    period: ReportingPeriod,
    filter: ProductPerformanceFilter,
  ): Promise<readonly ProductPerformanceFact[]>;
}
