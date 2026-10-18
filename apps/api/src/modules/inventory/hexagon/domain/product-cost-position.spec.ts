import { describe, expect, it } from 'vitest';

import { ProductCostPosition } from './product-cost-position';

const now = new Date('2026-09-15T17:00:00.000Z');

describe('ProductCostPosition', () => {
  it('keeps rounding residuals until the final unit leaves', () => {
    const cost = position(3, 100);

    expect(cost.removeAvailable(1, now)).toMatchObject({ ok: true, removedValueCents: 33 });
    expect(cost.removeAvailable(1, now)).toMatchObject({ ok: true, removedValueCents: 33 });
    expect(cost.removeAvailable(1, now)).toMatchObject({ ok: true, removedValueCents: 34 });
    expect(cost.snapshot()).toMatchObject({ availableQuantity: 0, availableValueCents: 0 });
  });

  it('values positive adjustments using the current moving average', () => {
    const cost = position(2, 500);

    expect(cost.addAvailableAtMovingAverage(2, 999, now)).toMatchObject({
      ok: true,
      addedValueCents: 500,
    });
    expect(cost.snapshot()).toMatchObject({ availableQuantity: 4, availableValueCents: 1000 });
  });

  it('requires and applies a declared unit cost when no prior cost exists', () => {
    const cost = position(0, 0);

    expect(cost.addAvailableAtMovingAverage(2, null, now)).toEqual({
      ok: false,
      reason: 'unit-cost-required',
    });
    expect(cost.addAvailableAtMovingAverage(2, 150, now)).toMatchObject({
      ok: true,
      addedValueCents: 300,
    });
  });

  it('moves the proportional value from available to reserved', () => {
    const cost = position(4, 1_000);
    expect(cost.reserveAvailable(2, now)).toMatchObject({ ok: true, reservedValueCents: 500 });
    expect(cost.snapshot()).toMatchObject({
      availableQuantity: 2,
      availableValueCents: 500,
      reservedQuantity: 2,
      reservedValueCents: 500,
      version: 2,
    });
  });

  it('restores the historical value to the condition selected for a return', () => {
    const available = position(2, 500);
    expect(available.receiveHistoricalReturn(1, 275, 'available', now)).toMatchObject({ ok: true });
    expect(available.snapshot()).toMatchObject({
      availableQuantity: 3,
      availableValueCents: 775,
      reviewQuantity: 0,
      reviewValueCents: 0,
      version: 2,
    });

    const review = position(2, 500);
    expect(review.receiveHistoricalReturn(1, 275, 'review', now)).toMatchObject({ ok: true });
    expect(review.snapshot()).toMatchObject({
      availableQuantity: 2,
      availableValueCents: 500,
      reviewQuantity: 1,
      reviewValueCents: 275,
      version: 2,
    });
  });

  it('releases the exact reserved historical value back to available cost', () => {
    const cost = ProductCostPosition.restore({
      ...position(2, 500).snapshot(),
      reservedQuantity: 2,
      reservedValueCents: 510,
    });
    expect(cost.releaseReserved(1, 255, now)).toMatchObject({ ok: true });
    expect(cost.snapshot()).toMatchObject({
      availableQuantity: 3,
      availableValueCents: 755,
      reservedQuantity: 1,
      reservedValueCents: 255,
      version: 2,
    });
  });

  it('consumes the exact historical value when reserved units are delivered', () => {
    const cost = ProductCostPosition.restore({
      ...position(2, 500).snapshot(),
      reservedQuantity: 2,
      reservedValueCents: 510,
    });
    expect(cost.removeReserved(1, 255, now)).toMatchObject({ ok: true });
    expect(cost.snapshot()).toMatchObject({
      availableQuantity: 2,
      availableValueCents: 500,
      reservedQuantity: 1,
      reservedValueCents: 255,
      version: 2,
    });
  });
});

function position(availableQuantity: number, availableValueCents: number): ProductCostPosition {
  return ProductCostPosition.restore({
    id: 'cost-1',
    productId: 'product-1',
    availableQuantity,
    availableValueCents,
    reservedQuantity: 0,
    reservedValueCents: 0,
    reviewQuantity: 0,
    reviewValueCents: 0,
    version: 1,
    policy: 'moving-average-v1',
    createdAt: now,
    updatedAt: now,
  });
}
