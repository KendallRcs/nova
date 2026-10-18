export type CostingPolicy = 'moving-average-v1';

export interface ProductCostPositionProperties {
  id: string;
  productId: string;
  availableQuantity: number;
  availableValueCents: number;
  reservedQuantity: number;
  reservedValueCents: number;
  reviewQuantity: number;
  reviewValueCents: number;
  version: number;
  policy: CostingPolicy;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCostSnapshot = ProductCostPositionProperties;

export type RemoveAvailableCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
      readonly removedValueCents: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'insufficient-cost-quantity';
      readonly availableQuantity?: number;
    };

export type AddAvailableCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
      readonly addedValueCents: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'unit-cost-required' | 'invalid-unit-cost';
    };

export type ReserveAvailableCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
      readonly reservedValueCents: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'insufficient-cost-quantity';
      readonly availableQuantity?: number;
    };

export type ReturnCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
    }
  | { readonly ok: false; readonly reason: 'invalid-quantity' | 'invalid-cost' };

export type ReleaseReservedCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'invalid-cost' | 'insufficient-reserved';
    };

export type RemoveReservedCostResult = ReleaseReservedCostResult;

export type ResolveReviewCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
      readonly resolvedValueCents: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid-quantity' | 'insufficient-review';
      readonly reviewQuantity?: number;
    };

export type ReceivePurchaseCostResult =
  | {
      readonly ok: true;
      readonly before: ProductCostSnapshot;
      readonly after: ProductCostSnapshot;
      readonly addedValueCents: number;
    }
  | { readonly ok: false; readonly reason: 'invalid-quantity' | 'invalid-cost' };

export class ProductCostPosition {
  private constructor(private properties: ProductCostPositionProperties) {}

  static empty(input: { id: string; productId: string; now: Date }): ProductCostPosition {
    return new ProductCostPosition({
      ...input,
      availableQuantity: 0,
      availableValueCents: 0,
      reservedQuantity: 0,
      reservedValueCents: 0,
      reviewQuantity: 0,
      reviewValueCents: 0,
      version: 1,
      policy: 'moving-average-v1',
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: ProductCostPositionProperties): ProductCostPosition {
    assertValidCostPosition(properties);
    return new ProductCostPosition({ ...properties });
  }

  snapshot(): ProductCostSnapshot {
    return { ...this.properties };
  }

  removeAvailable(quantity: number, now: Date): RemoveAvailableCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (before.availableQuantity < quantity) {
      return {
        ok: false,
        reason: 'insufficient-cost-quantity',
        availableQuantity: before.availableQuantity,
      };
    }
    const removedValueCents = proportionalValue(
      before.availableValueCents,
      quantity,
      before.availableQuantity,
    );
    this.properties = {
      ...this.properties,
      availableQuantity: before.availableQuantity - quantity,
      availableValueCents: before.availableValueCents - removedValueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot(), removedValueCents };
  }

  reserveAvailable(quantity: number, now: Date): ReserveAvailableCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (before.availableQuantity < quantity) {
      return {
        ok: false,
        reason: 'insufficient-cost-quantity',
        availableQuantity: before.availableQuantity,
      };
    }
    const reservedValueCents = proportionalValue(
      before.availableValueCents,
      quantity,
      before.availableQuantity,
    );
    this.properties = {
      ...this.properties,
      availableQuantity: before.availableQuantity - quantity,
      availableValueCents: before.availableValueCents - reservedValueCents,
      reservedQuantity: before.reservedQuantity + quantity,
      reservedValueCents: before.reservedValueCents + reservedValueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot(), reservedValueCents };
  }

  addAvailableAtMovingAverage(
    quantity: number,
    declaredUnitCostCents: number | null,
    now: Date,
  ): AddAvailableCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (before.availableQuantity === 0 && declaredUnitCostCents === null) {
      return { ok: false, reason: 'unit-cost-required' };
    }
    if (
      declaredUnitCostCents !== null &&
      (!Number.isSafeInteger(declaredUnitCostCents) || declaredUnitCostCents < 0)
    ) {
      return { ok: false, reason: 'invalid-unit-cost' };
    }
    const addedValueCents =
      before.availableQuantity === 0
        ? safeMultiply(declaredUnitCostCents ?? 0, quantity)
        : proportionalValue(before.availableValueCents, quantity, before.availableQuantity);
    this.properties = {
      ...this.properties,
      availableQuantity: before.availableQuantity + quantity,
      availableValueCents: before.availableValueCents + addedValueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot(), addedValueCents };
  }

  receivePurchase(quantity: number, unitCostCents: number, now: Date): ReceivePurchaseCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (!Number.isSafeInteger(unitCostCents) || unitCostCents <= 0) {
      return { ok: false, reason: 'invalid-cost' };
    }
    const addedValueCents = safeMultiply(quantity, unitCostCents);
    this.properties = {
      ...this.properties,
      availableQuantity: before.availableQuantity + quantity,
      availableValueCents: before.availableValueCents + addedValueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot(), addedValueCents };
  }

  receiveHistoricalReturn(
    quantity: number,
    valueCents: number,
    condition: 'available' | 'review',
    now: Date,
  ): ReturnCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (!Number.isSafeInteger(valueCents) || valueCents < 0) {
      return { ok: false, reason: 'invalid-cost' };
    }
    this.properties = {
      ...this.properties,
      availableQuantity:
        condition === 'available' ? before.availableQuantity + quantity : before.availableQuantity,
      availableValueCents:
        condition === 'available'
          ? before.availableValueCents + valueCents
          : before.availableValueCents,
      reviewQuantity:
        condition === 'review' ? before.reviewQuantity + quantity : before.reviewQuantity,
      reviewValueCents:
        condition === 'review' ? before.reviewValueCents + valueCents : before.reviewValueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot() };
  }

  releaseReserved(quantity: number, valueCents: number, now: Date): ReleaseReservedCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (!Number.isSafeInteger(valueCents) || valueCents < 0) {
      return { ok: false, reason: 'invalid-cost' };
    }
    if (quantity > before.reservedQuantity || valueCents > before.reservedValueCents) {
      return { ok: false, reason: 'insufficient-reserved' };
    }
    this.properties = {
      ...this.properties,
      availableQuantity: before.availableQuantity + quantity,
      availableValueCents: before.availableValueCents + valueCents,
      reservedQuantity: before.reservedQuantity - quantity,
      reservedValueCents: before.reservedValueCents - valueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot() };
  }

  removeReserved(quantity: number, valueCents: number, now: Date): RemoveReservedCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (!Number.isSafeInteger(valueCents) || valueCents < 0) {
      return { ok: false, reason: 'invalid-cost' };
    }
    if (quantity > before.reservedQuantity || valueCents > before.reservedValueCents) {
      return { ok: false, reason: 'insufficient-reserved' };
    }
    this.properties = {
      ...this.properties,
      reservedQuantity: before.reservedQuantity - quantity,
      reservedValueCents: before.reservedValueCents - valueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot() };
  }

  resolveReview(
    quantity: number,
    resolution: 'available' | 'write-off',
    now: Date,
  ): ResolveReviewCostResult {
    const before = this.snapshot();
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return { ok: false, reason: 'invalid-quantity' };
    }
    if (quantity > before.reviewQuantity) {
      return { ok: false, reason: 'insufficient-review', reviewQuantity: before.reviewQuantity };
    }
    const resolvedValueCents = proportionalValue(
      before.reviewValueCents,
      quantity,
      before.reviewQuantity,
    );
    this.properties = {
      ...this.properties,
      availableQuantity:
        resolution === 'available' ? before.availableQuantity + quantity : before.availableQuantity,
      availableValueCents:
        resolution === 'available'
          ? before.availableValueCents + resolvedValueCents
          : before.availableValueCents,
      reviewQuantity: before.reviewQuantity - quantity,
      reviewValueCents: before.reviewValueCents - resolvedValueCents,
      version: before.version + 1,
      updatedAt: now,
    };
    return { ok: true, before, after: this.snapshot(), resolvedValueCents };
  }
}

function proportionalValue(valueCents: number, quantity: number, totalQuantity: number): number {
  if (quantity === totalQuantity) return valueCents;
  const result = (BigInt(valueCents) * BigInt(quantity)) / BigInt(totalQuantity);
  return safeBigInt(result);
}

function safeMultiply(left: number, right: number): number {
  return safeBigInt(BigInt(left) * BigInt(right));
}

function safeBigInt(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Cost exceeds JSON safe integer range.');
  return result;
}

function assertValidCostPosition(properties: ProductCostPositionProperties): void {
  const balances = [
    [properties.availableQuantity, properties.availableValueCents],
    [properties.reservedQuantity, properties.reservedValueCents],
    [properties.reviewQuantity, properties.reviewValueCents],
  ] as const;
  if (
    balances.some(
      ([quantity, value]) =>
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        (quantity === 0 && value !== 0),
    ) ||
    !Number.isSafeInteger(properties.version) ||
    properties.version <= 0
  ) {
    throw new Error('Cannot restore an invalid product cost position.');
  }
}
