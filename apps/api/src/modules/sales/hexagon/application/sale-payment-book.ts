import type { PaymentMethod } from '../domain/sale';

export interface PreparedSalePayment {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  canRegisterAny: boolean;
  amountCents: number;
  method: PaymentMethod;
  effectiveAt: Date;
}

export interface SalePaymentReceipt {
  paymentId: string;
  operationId: string;
  saleId: string;
  saleVersion: number;
  amountCents: number;
  method: PaymentMethod;
  registeredBy: string;
  effectiveAt: Date;
  paidCents: number;
  balanceCents: number;
  paymentSituation: 'partial' | 'paid';
}

export type SalePaymentResult =
  | { readonly ok: true; readonly payment: SalePaymentReceipt; readonly replayed: boolean }
  | {
      readonly ok: false;
      readonly reason:
        | 'sale-not-found'
        | 'sale-not-payable'
        | 'not-owner'
        | 'version-conflict'
        | 'invalid-payment'
        | 'payment-exceeds-balance'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly balanceCents?: number;
    };

export interface SalePaymentBook {
  record(command: PreparedSalePayment): Promise<SalePaymentResult>;
}
