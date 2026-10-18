import type { ProcurementPaymentMethod } from '../domain/supplier-advance';

export interface PreparedPurchaseLine {
  lineId: string;
  inventoryMovementId: string;
  costMovementId: string;
  productId: string;
  destinationLocationId: string;
  quantity: number;
  unitCostCents: number;
  subtotalCents: number;
}

export interface PreparedPurchaseAdvanceApplication {
  applicationId: string;
  advanceId: string;
  expectedVersion: number;
  amountCents: number;
}

export interface PreparedPurchase {
  purchaseId: string;
  cashMovementId: string | null;
  operationId: string;
  supplierId: string;
  actorId: string;
  lines: readonly PreparedPurchaseLine[];
  advanceApplications: readonly PreparedPurchaseAdvanceApplication[];
  totalCents: number;
  advanceAppliedCents: number;
  newlyPaidCents: number;
  paymentMethod: ProcurementPaymentMethod | null;
  effectiveAt: Date;
}

export interface PurchaseLineReceipt {
  id: string;
  productId: string;
  destinationLocationId: string;
  quantity: number;
  unitCostCents: number;
  subtotalCents: number;
  previousAverageUnitCostCents: number | null;
  resultingAverageUnitCostCents: number;
  priceReviewSuggested: boolean;
}

export interface PurchaseReceipt {
  id: string;
  operationId: string;
  supplierId: string;
  totalCents: number;
  advanceAppliedCents: number;
  newlyPaidCents: number;
  paymentMethod: ProcurementPaymentMethod | null;
  createdBy: string;
  confirmedBy: string;
  effectiveAt: Date;
  lines: readonly PurchaseLineReceipt[];
}

export type PurchaseResult =
  | { readonly ok: true; readonly purchase: PurchaseReceipt; readonly replayed: boolean }
  | {
      readonly ok: false;
      readonly reason:
        | 'supplier-not-found'
        | 'product-not-found'
        | 'location-not-found'
        | 'advance-not-found'
        | 'advance-supplier-mismatch'
        | 'advance-version-conflict'
        | 'insufficient-advance-balance'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly referenceId?: string;
      readonly currentBalanceCents?: number;
    };

export interface PurchaseBook {
  confirm(command: PreparedPurchase): Promise<PurchaseResult>;
}
