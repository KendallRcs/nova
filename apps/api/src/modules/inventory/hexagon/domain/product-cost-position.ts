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
