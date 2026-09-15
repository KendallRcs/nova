import { describe, expect, it } from 'vitest';

import { InventoryPosition } from './inventory-position';

const now = new Date('2026-09-15T17:00:00.000Z');

describe('InventoryPosition', () => {
  it('derives availability and transfers only physical available units', () => {
    const origin = position('store', 10, 3, 2);
    const destination = position('warehouse', 1, 0, 0);

    const result = InventoryPosition.transferAvailable(origin, destination, 4, now);

    expect(result).toMatchObject({ ok: true });
    expect(origin.snapshot()).toMatchObject({
      physicalQuantity: 6,
      reservedQuantity: 3,
      reviewQuantity: 2,
      availableQuantity: 1,
      version: 2,
    });
    expect(destination.snapshot()).toMatchObject({
      physicalQuantity: 5,
      availableQuantity: 5,
      version: 2,
    });
  });

  it('rejects a transfer that would consume reserved or review units', () => {
    const origin = position('store', 10, 3, 2);
    const destination = position('warehouse', 0, 0, 0);

    expect(InventoryPosition.transferAvailable(origin, destination, 6, now)).toEqual({
      ok: false,
      reason: 'insufficient-stock',
      availableQuantity: 5,
    });
    expect(origin.snapshot()).toMatchObject({ physicalQuantity: 10, availableQuantity: 5 });
    expect(destination.snapshot()).toMatchObject({ physicalQuantity: 0 });
  });
});

function position(
  locationId: string,
  physicalQuantity: number,
  reservedQuantity: number,
  reviewQuantity: number,
): InventoryPosition {
  return InventoryPosition.restore({
    id: `position-${locationId}`,
    productId: 'product-1',
    locationId,
    physicalQuantity,
    reservedQuantity,
    reviewQuantity,
    version: 1,
    createdAt: new Date('2026-09-14T17:00:00.000Z'),
    updatedAt: new Date('2026-09-14T17:00:00.000Z'),
  });
}
