import type { ProcurementPaymentMethod } from '../domain/supplier-advance';

interface ResolutionBase {
  resolutionId: string;
  operationId: string;
  advanceId: string;
  expectedVersion: number;
  amountCents: number;
  actorId: string;
  effectiveAt: Date;
}

export type PreparedAdvanceResolution =
  | (ResolutionBase & {
      kind: 'refund';
      cashMovementId: string;
      method: ProcurementPaymentMethod;
    })
  | (ResolutionBase & { kind: 'loss'; reason: string });

export interface AdvanceResolutionReceipt {
  id: string;
  operationId: string;
  advanceId: string;
  type: 'refund' | 'loss';
  amountCents: number;
  method: ProcurementPaymentMethod | null;
  reason: string | null;
  currentBalanceCents: number;
  status: 'pending' | 'resolved';
  advanceVersion: number;
  registeredBy: string;
  effectiveAt: Date;
}

export type AdvanceResolutionResult =
  | { readonly ok: true; readonly resolution: AdvanceResolutionReceipt; readonly replayed: boolean }
  | {
      readonly ok: false;
      readonly reason:
        | 'advance-not-found'
        | 'version-conflict'
        | 'insufficient-balance'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly currentBalanceCents?: number;
    };

export interface SupplierAdvanceResolutionBook {
  resolve(command: PreparedAdvanceResolution): Promise<AdvanceResolutionResult>;
}
