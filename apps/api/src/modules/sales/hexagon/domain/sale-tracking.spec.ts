import { describe, expect, it } from 'vitest';

import { deriveSaleTracking } from './sale-tracking';

describe('sale tracking', () => {
  it('derives partial payment, partial delivery and overdue status independently', () => {
    expect(
      deriveSaleTracking({
        lifecycle: 'confirmed',
        currentTotalCents: 5_000,
        paymentAmountsCents: [1_000, 500],
        refundAmountsCents: [],
        forgivenAmountCents: 0,
        lineQuantities: [
          { quantity: 2, deliveredQuantity: 1 },
          { quantity: 1, deliveredQuantity: 0 },
        ],
        dueDate: '2026-09-15',
        todayInLima: '2026-09-16',
      }),
    ).toEqual({
      paidCents: 1_500,
      balanceCents: 3_500,
      paymentSituation: 'partial',
      deliverySituation: 'partial',
      overdue: true,
    });
  });

  it('does not treat a draft as debt or delivered stock', () => {
    expect(
      deriveSaleTracking({
        lifecycle: 'draft',
        currentTotalCents: 2_000,
        paymentAmountsCents: [],
        refundAmountsCents: [],
        forgivenAmountCents: 0,
        lineQuantities: [{ quantity: 1, deliveredQuantity: 1 }],
        dueDate: '2026-09-01',
        todayInLima: '2026-09-16',
      }),
    ).toMatchObject({
      paymentSituation: 'not-applicable',
      deliverySituation: 'not-applicable',
      overdue: false,
    });
  });

  it('distinguishes a finalized sale with a forgiven balance from a fully paid sale', () => {
    expect(
      deriveSaleTracking({
        lifecycle: 'finalized',
        currentTotalCents: 5_000,
        paymentAmountsCents: [3_500],
        refundAmountsCents: [],
        forgivenAmountCents: 1_500,
        lineQuantities: [{ quantity: 1, deliveredQuantity: 1 }],
        dueDate: '2026-09-01',
        todayInLima: '2026-09-16',
      }),
    ).toMatchObject({
      paidCents: 3_500,
      balanceCents: 0,
      paymentSituation: 'closed-with-balance',
      overdue: false,
    });
  });
});
