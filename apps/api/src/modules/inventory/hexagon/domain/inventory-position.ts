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
