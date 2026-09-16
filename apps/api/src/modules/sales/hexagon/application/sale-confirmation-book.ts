export interface PreparedSaleConfirmation {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  canConfirmAny: boolean;
  canApprovePriceException: boolean;
  priceExceptions: readonly { saleLineId: string; reason: string }[];
  effectiveAt: Date;
}

export interface SaleConfirmationReceipt {
  saleId: string;
  operationId: string;
  version: number;
  confirmedBy: string;
  confirmedAt: Date;
  totalCents: number;
  deliveredQuantity: number;
  reservedQuantity: number;
  allocatedCostCents: number;
}

export type SaleConfirmationResult =
  | {
      readonly ok: true;
      readonly confirmation: SaleConfirmationReceipt;
      readonly replayed: boolean;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'sale-not-found'
        | 'sale-not-draft'
        | 'not-owner'
        | 'version-conflict'
        | 'empty-sale'
        | 'customer-required'
        | 'customer-not-found'
        | 'product-not-found'
        | 'location-not-found'
        | 'price-approval-required'
        | 'price-exception-reason-required'
        | 'insufficient-stock'
        | 'cost-unavailable'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly referenceId?: string;
      readonly availableQuantity?: number;
    };

export interface SaleConfirmationBook {
  confirm(command: PreparedSaleConfirmation): Promise<SaleConfirmationResult>;
}
