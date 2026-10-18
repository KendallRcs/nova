export interface PreparedSaleDelivery {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  canDeliverAny: boolean;
  lines: readonly { saleLineId: string; quantity: number }[];
  effectiveAt: Date;
}

export interface SaleDeliveryReceipt {
  deliveryId: string;
  operationId: string;
  saleId: string;
  saleVersion: number;
  deliveredQuantity: number;
  remainingReservedQuantity: number;
  deliveredBy: string;
  effectiveAt: Date;
  lines: readonly {
    saleLineId: string;
    locationId: string;
    quantity: number;
    consumedCostCents: number;
  }[];
}

export type SaleDeliveryResult =
  | { ok: true; delivery: SaleDeliveryReceipt; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'sale-not-found'
        | 'sale-not-deliverable'
        | 'not-owner'
        | 'version-conflict'
        | 'empty-delivery'
        | 'duplicate-line'
        | 'sale-line-not-found'
        | 'invalid-quantity'
        | 'quantity-exceeds-reserved'
        | 'cost-unavailable'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      saleLineId?: string;
      deliverableQuantity?: number;
    };

export interface SaleDeliveryBook {
  deliver(command: PreparedSaleDelivery): Promise<SaleDeliveryResult>;
}
