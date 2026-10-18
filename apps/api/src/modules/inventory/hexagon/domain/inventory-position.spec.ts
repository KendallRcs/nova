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

  it('writes off only available units', () => {
    const inventory = position('store', 10, 3, 2);

    expect(inventory.writeOffAvailable(5, now)).toMatchObject({ ok: true });
    expect(inventory.snapshot()).toMatchObject({
      physicalQuantity: 5,
      reservedQuantity: 3,
      reviewQuantity: 2,
      availableQuantity: 0,
      version: 2,
    });
    expect(inventory.writeOffAvailable(1, now)).toEqual({
      ok: false,
      reason: 'insufficient-stock',
      availableQuantity: 0,
    });
  });

  it('adjusts a count without consuming protected units', () => {
    const inventory = position('store', 10, 3, 2);

    expect(inventory.adjustToPhysicalCount(4, now)).toEqual({
      ok: false,
      reason: 'protected-stock',
      minimumPhysicalQuantity: 5,
    });
    expect(inventory.adjustToPhysicalCount(7, now)).toMatchObject({
      ok: true,
      difference: -3,
    });
    expect(inventory.snapshot()).toMatchObject({ physicalQuantity: 7, availableQuantity: 2 });
  });

  it('reserves and delivers only from available units for a sale', () => {
    const inventory = position('store', 5, 0, 0);
    expect(inventory.reserveAvailable(2, now)).toMatchObject({ ok: true });
    expect(inventory.deliverAvailable(2, now)).toMatchObject({ ok: true });
    expect(inventory.snapshot()).toMatchObject({
      physicalQuantity: 3,
      reservedQuantity: 2,
      availableQuantity: 1,
      version: 3,
    });
  });

  it('receives a returned unit as available or under review', () => {
    const available = position('store', 3, 1, 0);
    expect(available.receiveReturn(2, 'available', now)).toMatchObject({ ok: true });
    expect(available.snapshot()).toMatchObject({
      physicalQuantity: 5,
      reservedQuantity: 1,
      reviewQuantity: 0,
      availableQuantity: 4,
      version: 2,
    });

    const review = position('warehouse', 3, 1, 0);
    expect(review.receiveReturn(2, 'review', now)).toMatchObject({ ok: true });
    expect(review.snapshot()).toMatchObject({
      physicalQuantity: 5,
      reservedQuantity: 1,
      reviewQuantity: 2,
      availableQuantity: 2,
      version: 2,
    });
  });

  it('releases reserved units without changing physical stock', () => {
    const inventory = position('store', 5, 3, 0);
    expect(inventory.releaseReserved(2, now)).toMatchObject({ ok: true });
    expect(inventory.snapshot()).toMatchObject({
      physicalQuantity: 5,
      reservedQuantity: 1,
      availableQuantity: 4,
      version: 2,
    });
    expect(inventory.releaseReserved(2, now)).toEqual({
      ok: false,
      reason: 'insufficient-reserved',
    });
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
