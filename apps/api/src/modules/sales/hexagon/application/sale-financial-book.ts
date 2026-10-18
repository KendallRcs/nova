import type { PaymentMethod } from '../domain/sale';

interface PreparedFinancialOperation {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  effectiveAt: Date;
}

export interface PreparedSaleTotalAdjustment extends PreparedFinancialOperation {
  newTotalCents: number;
  reason: string;
}

export interface SaleTotalAdjustmentReceipt {
  adjustmentId: string;
  operationId: string;
  saleId: string;
  saleVersion: number;
  previousTotalCents: number;
  currentTotalCents: number;
  differenceCents: number;
  reason: string;
  changedBy: string;
  effectiveAt: Date;
}

export type SaleTotalAdjustmentResult =
  | { ok: true; adjustment: SaleTotalAdjustmentReceipt; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'sale-not-found'
        | 'sale-not-adjustable'
        | 'not-authorized'
        | 'version-conflict'
        | 'invalid-total'
        | 'reason-required'
        | 'total-below-paid'
        | 'customer-required'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      paidCents?: number;
    };

export interface SaleTotalAdjustmentBook {
  adjust(command: PreparedSaleTotalAdjustment): Promise<SaleTotalAdjustmentResult>;
}

export interface PreparedSaleClosure extends PreparedFinancialOperation {
  reason: string | null;
}

export interface SaleClosureReceipt {
  closureId: string;
  operationId: string;
  saleId: string;
  saleVersion: number;
  type: 'complete' | 'incomplete';
  forgivenAmountCents: number;
  reason: string | null;
  closedBy: string;
  effectiveAt: Date;
}

export type SaleClosureResult =
  | { ok: true; closure: SaleClosureReceipt; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'sale-not-found'
        | 'sale-not-finalizable'
        | 'not-authorized'
        | 'version-conflict'
        | 'reason-required'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
    };

export interface SaleClosureBook {
  close(command: PreparedSaleClosure): Promise<SaleClosureResult>;
}

export interface PreparedPaymentCorrection extends PreparedFinancialOperation {
  paymentId: string;
  amountCents: number;
  reason: string;
}

export interface PaymentCorrectionReceipt {
  correctionId: string;
  operationId: string;
  saleId: string;
  paymentId: string;
  saleVersion: number;
  amountCents: number;
  method: PaymentMethod;
  reason: string;
  correctedBy: string;
  effectiveAt: Date;
}

export type PaymentCorrectionResult =
  | { ok: true; correction: PaymentCorrectionReceipt; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'sale-not-found'
        | 'sale-not-correctable'
        | 'not-authorized'
        | 'payment-not-found'
        | 'version-conflict'
        | 'invalid-correction'
        | 'reason-required'
        | 'correction-exceeds-payment'
        | 'customer-required'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      correctableCents?: number;
    };

export interface PaymentCorrectionBook {
  correct(command: PreparedPaymentCorrection): Promise<PaymentCorrectionResult>;
}
