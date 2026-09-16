export type InventoryWriteOffCategory = 'damaged' | 'lost' | 'defective' | 'other';

interface PreparedInventoryAdministration {
  movementId: string;
  costMovementId: string;
  operationId: string;
  productId: string;
  locationId: string;
  reason: string;
  actorId: string;
  effectiveAt: Date;
}

export interface PreparedInventoryWriteOff extends PreparedInventoryAdministration {
  kind: 'write-off';
  quantity: number;
  category: InventoryWriteOffCategory;
}

export interface PreparedInventoryCountAdjustment extends PreparedInventoryAdministration {
  kind: 'count-adjustment';
  observedPhysicalQuantity: number;
  expectedPositionVersion: number;
  declaredUnitCostCents: number | null;
}

export type PreparedInventoryAdministrationCommand =
  PreparedInventoryWriteOff | PreparedInventoryCountAdjustment;

export interface InventoryAdministrationReceipt {
  movementId: string;
  operationId: string;
  productId: string;
  locationId: string;
  type: 'write-off' | 'adjustment-in' | 'adjustment-out';
  physicalDelta: number;
  valueDeltaCents: number;
  physicalQuantity: number;
  reservedQuantity: number;
  reviewQuantity: number;
  availableQuantity: number;
  availableCostQuantity: number;
  availableCostValueCents: number;
  actorId: string;
  effectiveAt: Date;
  reason: string;
  category: InventoryWriteOffCategory | null;
  declaredUnitCostCents: number | null;
}

export type InventoryAdministrationResult =
  | {
      readonly ok: true;
      readonly movement: InventoryAdministrationReceipt;
      readonly replayed: boolean;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'product-not-found'
        | 'location-not-found'
        | 'invalid-quantity'
        | 'invalid-count'
        | 'invalid-reason'
        | 'invalid-category'
        | 'invalid-unit-cost'
        | 'unit-cost-required'
        | 'insufficient-stock'
        | 'protected-stock'
        | 'no-difference'
        | 'cost-unavailable'
        | 'version-conflict'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
      readonly availableQuantity?: number;
      readonly minimumPhysicalQuantity?: number;
    };

export interface InventoryAdministrationBook {
  execute(command: PreparedInventoryAdministrationCommand): Promise<InventoryAdministrationResult>;
}
