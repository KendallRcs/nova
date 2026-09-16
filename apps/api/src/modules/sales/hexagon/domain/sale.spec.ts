import { describe, expect, it } from 'vitest';

import { Sale } from './sale';

describe('Sale draft', () => {
  it('keeps multiple products and calculates the agreed total', () => {
    const result = Sale.createDraft({
      id: 'sale-1',
      createdBy: 'employee-1',
      customerId: null,
      lines: [
        line('line-1', 'product-1', 2, 1_500, 2, 0),
        line('line-2', 'product-2', 3, 800, 0, 2),
      ],
      now: new Date('2026-09-15T20:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.toPrimitives()).toMatchObject({
      lifecycle: 'draft',
      originalTotalCents: 5_400,
      currentTotalCents: 5_400,
      version: 1,
    });
  });

  it('rejects a repeated product', () => {
    const result = Sale.createDraft({
      id: 'sale-1',
      createdBy: 'employee-1',
      lines: [line('line-1', 'product-1', 1, 100, 1, 0), line('line-2', 'product-1', 1, 100, 0, 1)],
      now: new Date(),
    });
    expect(result).toEqual({ ok: false, reason: 'duplicate-product', productId: 'product-1' });
  });

  it('rejects fulfillment greater than the sold quantity', () => {
    const result = Sale.createDraft({
      id: 'sale-1',
      createdBy: 'employee-1',
      lines: [line('line-1', 'product-1', 2, 100, 1, 2)],
      now: new Date(),
    });
    expect(result).toEqual({ ok: false, reason: 'invalid-fulfillment', productId: 'product-1' });
  });
});

function line(
  id: string,
  productId: string,
  quantity: number,
  agreedUnitPriceCents: number,
  deliveryQuantity: number,
  reservationQuantity: number,
) {
  return {
    id,
    productId,
    locationId: 'location-1',
    quantity,
    deliveryQuantity,
    reservationQuantity,
    agreedUnitPriceCents,
  };
}
