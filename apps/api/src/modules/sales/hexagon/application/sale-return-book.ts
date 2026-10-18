import type { PaymentMethod } from '../domain/sale';

export interface PreparedSaleReturn {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  reason: string;
  refundMethod: PaymentMethod | null;
  lines: readonly {
    saleLineId: string;
    quantity: number;
    productReturns: boolean;
    returnLocationId: string | null;
    condition: 'available' | 'review' | null;
  }[];
  effectiveAt: Date;
}

export interface SaleReturnReceipt {
  returnId: string;
  operationId: string;
  saleId: string;
  saleVersion: number;
  commercialReductionCents: number;
  refundAmountCents: number;
  refundMethod: PaymentMethod | null;
  currentTotalCents: number;
  paidCents: number;
  balanceCents: number;
  approvedBy: string;
  effectiveAt: Date;
}

export type SaleReturnResult =
  | { ok: true; saleReturn: SaleReturnReceipt; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'sale-not-found'
        | 'sale-not-returnable'
        | 'not-authorized'
        | 'version-conflict'
        | 'reason-required'
        | 'empty-return'
        | 'duplicate-line'
        | 'sale-line-not-found'
        | 'invalid-quantity'
        | 'quantity-exceeds-delivered'
        | 'invalid-return-treatment'
        | 'cost-unavailable'
        | 'refund-method-required'
        | 'location-not-found'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      saleLineId?: string;
      returnableQuantity?: number;
      referenceId?: string;
    };

export interface SaleReturnBook {
  approve(command: PreparedSaleReturn): Promise<SaleReturnResult>;
}
