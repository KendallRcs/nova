export interface InventoryPositionProperties {
  id: string;
  productId: string;
  locationId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  reviewQuantity: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryPositionSnapshot extends InventoryPositionProperties {
  availableQuantity: number;
}

export type TransferPositionResult =
  | {
      readonly ok: true;
      readonly originBefore: InventoryPositionSnapshot;
      readonly originAfter: InventoryPositionSnapshot;
      readonly destinationBefore: InventoryPositionSnapshot;
      readonly destinationAfter: InventoryPositionSnapshot;
    }
  | {
      readonly ok: false;
      readonly reason:
        'invalid-quantity' | 'same-location' | 'different-product' | 'insufficient-stock';
      readonly availableQuantity?: number;
    };

export type WriteOffPositionResult =
  | {
      readonly ok: true;
      readonly before: InventoryPositionSnapshot;
      readonly after: InventoryPositionSnapshot;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'insufficient-stock';
      readonly availableQuantity?: number;
    };

export type FulfillSalePositionResult =
  | {
      readonly ok: true;
      readonly before: InventoryPositionSnapshot;
      readonly after: InventoryPositionSnapshot;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'insufficient-stock';
      readonly availableQuantity?: number;
    };

export type AdjustPositionResult =
  | {
      readonly ok: true;
      readonly before: InventoryPositionSnapshot;
      readonly after: InventoryPositionSnapshot;
      readonly difference: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-count' | 'protected-stock' | 'no-difference';
      readonly minimumPhysicalQuantity?: number;
    };

export class InventoryPosition {
  private constructor(private properties: InventoryPositionProperties) {}

  static empty(input: {
    id: string;
    productId: string;
    locationId: string;
    now: Date;
  }): InventoryPosition {
    return new InventoryPosition({
      ...input,
      physicalQuantity: 0,
      reservedQuantity: 0,
      reviewQuantity: 0,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: InventoryPositionProperties): InventoryPosition {
    assertValidPosition(properties);
    return new InventoryPosition({ ...properties });
  }

  snapshot(): InventoryPositionSnapshot {
    return {
      ...this.properties,
      availableQuantity:
        this.properties.physicalQuantity -
        this.properties.reservedQuantity -
        this.properties.reviewQuantity,
    };
  }

  static transferAvailable(
    origin: InventoryPosition,
    destination: InventoryPosition,
    quantity: number,
    now: Date,
  ): TransferPositionResult {
    const originBefore = origin.snapshot();
    const destinationBefore = destination.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (originBefore.locationId === destinationBefore.locationId) {
      return { ok: false, reason: 'same-location' };
    }
    if (originBefore.productId !== destinationBefore.productId) {
      return { ok: false, reason: 'different-product' };
    }
    if (originBefore.availableQuantity < quantity) {
      return {
        ok: false,
        reason: 'insufficient-stock',
        availableQuantity: originBefore.availableQuantity,
      };
    }

    origin.properties = {
      ...origin.properties,
      physicalQuantity: originBefore.physicalQuantity - quantity,
      version: originBefore.version + 1,
      updatedAt: now,
    };
    destination.properties = {
      ...destination.properties,
      physicalQuantity: destinationBefore.physicalQuantity + quantity,
      version: destinationBefore.version + 1,
      updatedAt: now,
    };
    return {
      ok: true,
      originBefore,
      originAfter: origin.snapshot(),
      destinationBefore,
      destinationAfter: destination.snapshot(),
    };
  }

  writeOffAvailable(quantity: number, now: Date): WriteOffPositionResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (before.availableQuantity < quantity) {
      return {
        ok: false,
        reason: 'insufficient-stock',
        availableQuantity: before.availableQuantity,
      };
    }
    this.properties = {
      ...this.properties,
      physicalQuantity: before.physicalQuantity - quantity,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot() };
  }

  reserveAvailable(quantity: number, now: Date): FulfillSalePositionResult {
    const before = this.snapshot();
    const error = validateAvailableChange(quantity, before.availableQuantity);
    if (error !== null) return error;
    this.properties = {
      ...this.properties,
      reservedQuantity: before.reservedQuantity + quantity,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot() };
  }

  deliverAvailable(quantity: number, now: Date): FulfillSalePositionResult {
    const before = this.snapshot();
    const error = validateAvailableChange(quantity, before.availableQuantity);
    if (error !== null) return error;
    this.properties = {
      ...this.properties,
      physicalQuantity: before.physicalQuantity - quantity,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot() };
  }

  adjustToPhysicalCount(observedPhysicalQuantity: number, now: Date): AdjustPositionResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(observedPhysicalQuantity) || observedPhysicalQuantity < 0) {
      return { ok: false, reason: 'invalid-count' };
    }
    const minimumPhysicalQuantity = before.reservedQuantity + before.reviewQuantity;
    if (observedPhysicalQuantity < minimumPhysicalQuantity) {
      return { ok: false, reason: 'protected-stock', minimumPhysicalQuantity };
    }
    const difference = observedPhysicalQuantity - before.physicalQuantity;
    if (difference === 0) return { ok: false, reason: 'no-difference' };
    this.properties = {
      ...this.properties,
      physicalQuantity: observedPhysicalQuantity,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot(), difference };
  }
}

function validateAvailableChange(
  quantity: number,
  availableQuantity: number,
): Exclude<FulfillSalePositionResult, { ok: true }> | null {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, reason: 'invalid-quantity' };
  }
  if (availableQuantity < quantity) {
    return { ok: false, reason: 'insufficient-stock', availableQuantity };
  }
  return null;
}

function assertValidPosition(properties: InventoryPositionProperties): void {
  const quantities = [
    properties.physicalQuantity,
    properties.reservedQuantity,
    properties.reviewQuantity,
  ];
  if (
    quantities.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 0) ||
    properties.reservedQuantity + properties.reviewQuantity > properties.physicalQuantity ||
    !Number.isSafeInteger(properties.version) ||
    properties.version <= 0
  ) {
    throw new Error('Cannot restore an invalid inventory position.');
  }
}
