import { describe, expect, it } from 'vitest';

import { preparePurchase } from './purchase';

describe('preparePurchase', () => {
  it('calculates the new cash payment after applying multiple advances', () => {
    expect(
      preparePurchase({
        lines: [
          {
            productId: 'product-a',
            destinationLocationId: 'store',
            quantity: 2,
            unitCostCents: 300,
          },
          {
            productId: 'product-b',
            destinationLocationId: 'warehouse',
            quantity: 1,
            unitCostCents: 400,
          },
        ],
        advanceApplications: [
          { advanceId: 'advance-a', expectedVersion: 1, amountCents: 300 },
          { advanceId: 'advance-b', expectedVersion: 2, amountCents: 200 },
        ],
        paymentMethod: 'pos',
      }),
    ).toMatchObject({
      ok: true,
      terms: { totalCents: 1_000, advanceAppliedCents: 500, newlyPaidCents: 500 },
    });
  });

  it('allows a fully prepaid purchase without inventing a payment method', () => {
    expect(
      preparePurchase({
        lines: [
          {
            productId: 'product-a',
            destinationLocationId: 'store',
            quantity: 1,
            unitCostCents: 500,
          },
        ],
        advanceApplications: [{ advanceId: 'advance-a', expectedVersion: 1, amountCents: 500 }],
        paymentMethod: null,
      }),
    ).toMatchObject({ ok: true, terms: { newlyPaidCents: 0, paymentMethod: null } });
  });

  it('rejects different costs for the same product inside one purchase', () => {
    expect(
      preparePurchase({
        lines: [
          {
            productId: 'product-a',
            destinationLocationId: 'store',
            quantity: 1,
            unitCostCents: 300,
          },
          {
            productId: 'product-a',
            destinationLocationId: 'warehouse',
            quantity: 1,
            unitCostCents: 301,
          },
        ],
        advanceApplications: [],
        paymentMethod: 'cash',
      }),
    ).toEqual({ ok: false, reason: 'inconsistent-product-cost' });
  });

  it('rejects a zero unit cost because a confirmed purchase needs a real acquisition cost', () => {
    expect(
      preparePurchase({
        lines: [
          {
            productId: 'product-a',
            destinationLocationId: 'store',
            quantity: 1,
            unitCostCents: 0,
          },
        ],
        advanceApplications: [],
        paymentMethod: null,
      }),
    ).toEqual({ ok: false, reason: 'invalid-line' });
  });

  it('rejects advances above the total without changing external state', () => {
    expect(
      preparePurchase({
        lines: [
          {
            productId: 'product-a',
            destinationLocationId: 'store',
            quantity: 1,
            unitCostCents: 500,
          },
        ],
        advanceApplications: [{ advanceId: 'advance-a', expectedVersion: 1, amountCents: 501 }],
        paymentMethod: null,
      }),
    ).toEqual({ ok: false, reason: 'advance-applications-exceed-total' });
  });
});
