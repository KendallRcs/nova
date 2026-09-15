export interface PreparedInventoryTransfer {
  transferId: string;
  operationId: string;
  productId: string;
  originLocationId: string;
  destinationLocationId: string;
  quantity: number;
  actorId: string;
  effectiveAt: Date;
}

export interface InventoryBalance {
  locationId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  reviewQuantity: number;
  availableQuantity: number;
}

export interface InventoryTransferReceipt extends PreparedInventoryTransfer {
  origin: InventoryBalance;
  destination: InventoryBalance;
}

export type InventoryTransferResult =
  | { readonly ok: true; readonly transfer: InventoryTransferReceipt; readonly replayed: boolean }
  | {
      readonly ok: false;
      readonly reason:
        | 'product-not-found'
        | 'location-not-found'
        | 'invalid-quantity'
        | 'same-location'
        | 'insufficient-stock'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly availableQuantity?: number;
    };

export interface InventoryTransferBook {
  transfer(command: PreparedInventoryTransfer): Promise<InventoryTransferResult>;
}
