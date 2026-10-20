import type { ProcurementPaymentMethod } from '../domain/supplier-advance';

export type PurchaseSupplierKind = 'registered' | 'occasional';

export interface PurchaseHistoryItem {
  readonly id: string;
  readonly supplier: {
    readonly id: string;
    readonly name: string;
    readonly kind: PurchaseSupplierKind;
  };
  readonly totalCents: number;
  readonly advanceAppliedCents: number;
  readonly newlyPaidCents: number;
  readonly paymentMethod: ProcurementPaymentMethod | null;
  readonly lineCount: number;
  readonly totalQuantity: number;
  readonly confirmedBy: string;
  readonly confirmerUsername: string;
  readonly effectiveAt: Date;
}

export interface PurchaseHistoryPage {
  readonly items: readonly PurchaseHistoryItem[];
  readonly nextPurchaseId: string | null;
}

export interface PurchaseDetail extends PurchaseHistoryItem {
  readonly operationId: string;
  readonly createdBy: string;
  readonly creatorUsername: string;
  readonly createdAt: Date;
  readonly lines: readonly {
    readonly id: string;
    readonly productId: string;
    readonly currentProductCode: string;
    readonly currentProductName: string;
    readonly destinationLocationId: string;
    readonly destinationLocationCode: string;
    readonly destinationLocationName: string;
    readonly quantity: number;
    readonly unitCostCents: number;
    readonly subtotalCents: number;
    readonly previousAverageUnitCostCents: number | null;
    readonly resultingAverageUnitCostCents: number;
    readonly priceReviewSuggested: boolean;
  }[];
  readonly advanceApplications: readonly {
    readonly id: string;
    readonly advanceId: string;
    readonly amountCents: number;
    readonly resultingBalanceCents: number;
    readonly resultingAdvanceVersion: number;
  }[];
}

export interface PurchaseHistoryDirectory {
  list(input: {
    supplierId?: string;
    productId?: string;
    afterPurchaseId?: string;
    limit: number;
  }): Promise<PurchaseHistoryPage>;
  findById(purchaseId: string): Promise<PurchaseDetail | null>;
}

export class ListPurchases {
  constructor(private readonly directory: PurchaseHistoryDirectory) {}

  execute(input: Parameters<PurchaseHistoryDirectory['list']>[0]): Promise<PurchaseHistoryPage> {
    return this.directory.list(input);
  }
}

export type GetPurchaseDetailResult =
  | { readonly ok: true; readonly purchase: PurchaseDetail }
  | { readonly ok: false; readonly reason: 'purchase-not-found' };

export class GetPurchaseDetail {
  constructor(private readonly directory: PurchaseHistoryDirectory) {}

  async execute(purchaseId: string): Promise<GetPurchaseDetailResult> {
    const purchase = await this.directory.findById(purchaseId);
    return purchase === null ? { ok: false, reason: 'purchase-not-found' } : { ok: true, purchase };
  }
}
