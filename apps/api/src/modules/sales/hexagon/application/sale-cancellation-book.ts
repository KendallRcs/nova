import type { PaymentMethod } from '../domain/sale';

export interface PreparedSaleCancellation {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  reason: string;
  refundAmountCents: number;
  refundMethod: PaymentMethod | null;
  lines: readonly {
    saleLineId: string;
    returnedQuantity: number;
    notReturnedQuantity: number;
    returnLocationId: string | null;
    condition: 'available' | 'review' | null;
  }[];
  effectiveAt: Date;
}

export interface SaleCancellationReceipt {
  cancellationId: string;
  operationId: string;
  saleId: string;
  saleVersion: number;
  refundAmountCents: number;
  refundMethod: PaymentMethod | null;
  paidCents: number;
  releasedQuantity: number;
  returnedQuantity: number;
  notReturnedQuantity: number;
  cancelledBy: string;
  effectiveAt: Date;
}

export type SaleCancellationResult =
  | { ok: true; cancellation: SaleCancellationReceipt; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'sale-not-found'
        | 'sale-not-cancellable'
        | 'not-authorized'
        | 'version-conflict'
        | 'reason-required'
        | 'incomplete-line-treatment'
        | 'duplicate-line'
        | 'sale-line-not-found'
        | 'invalid-quantity'
        | 'invalid-return-treatment'
        | 'invalid-release-cost'
        | 'cost-unavailable'
        | 'invalid-refund'
        | 'refund-exceeds-paid'
        | 'invalid-refund-treatment'
        | 'location-not-found'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      saleLineId?: string;
      paidCents?: number;
      referenceId?: string;
    };

export interface SaleCancellationBook {
  cancel(command: PreparedSaleCancellation): Promise<SaleCancellationResult>;
}
