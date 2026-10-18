import type { ProcurementPaymentMethod } from '../domain/supplier-advance';

export interface PreparedSupplierAdvance {
  advanceId: string;
  cashMovementId: string;
  operationId: string;
  supplierId: string;
  amountCents: number;
  method: ProcurementPaymentMethod;
  purpose: string | null;
  actorId: string;
  effectiveAt: Date;
}

export interface SupplierAdvanceReceipt {
  id: string;
  operationId: string;
  supplierId: string;
  originalAmountCents: number;
  currentBalanceCents: number;
  method: ProcurementPaymentMethod;
  purpose: string | null;
  status: 'pending' | 'resolved';
  version: number;
  registeredBy: string;
  effectiveAt: Date;
}

export type SupplierAdvanceResult =
  | { readonly ok: true; readonly advance: SupplierAdvanceReceipt; readonly replayed: boolean }
  | {
      readonly ok: false;
      readonly reason: 'supplier-not-found' | 'idempotency-conflict' | 'concurrency-conflict';
    };

export interface SupplierAdvanceBook {
  register(command: PreparedSupplierAdvance): Promise<SupplierAdvanceResult>;
}
