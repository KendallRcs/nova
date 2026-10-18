import { describe, expect, it } from 'vitest';

import { GetSaleDetail, type SaleDetailRecord, type SaleDetailSource } from './sale-detail';

describe('GetSaleDetail', () => {
  it('hides cost from an employee and derives the current balance', async () => {
    const detail = new GetSaleDetail(source(record()), {
      now: () => new Date('2026-10-18T15:00:00.000Z'),
    });
    const result = await detail.execute({
      saleId: 'sale-1',
      actorId: 'employee-1',
      canReadAny: false,
      canReadCost: false,
    });
    expect(result).toMatchObject({
      ok: true,
      sale: {
        paidCents: 1_000,
        balanceCents: 2_000,
        overdue: true,
        lines: [{ allocatedCostCents: null }],
      },
    });
  });

  it('rejects an employee reading another account sale', async () => {
    const result = await new GetSaleDetail(source(record()), { now: () => new Date() }).execute({
      saleId: 'sale-1',
      actorId: 'employee-2',
      canReadAny: false,
      canReadCost: false,
    });
    expect(result).toEqual({ ok: false, reason: 'not-owner' });
  });
});

function source(value: SaleDetailRecord): SaleDetailSource {
  return { findById: () => Promise.resolve(value) };
}

function record(): SaleDetailRecord {
  return {
    id: 'sale-1',
    createdBy: 'employee-1',
    creatorUsername: 'employee',
    customer: null,
    lifecycle: 'confirmed',
    originalTotalCents: 3_000,
    currentTotalCents: 3_000,
    dueDate: '2026-10-01',
    paymentAgreementNote: null,
    paymentAmountsCents: [1_000],
    refundAmountsCents: [],
    forgivenAmountCents: 0,
    lines: [
      {
        id: 'line-1',
        productId: 'product-1',
        locationId: 'location-1',
        locationCode: 'STORE',
        locationName: 'Tienda',
        quantity: 2,
        deliveryQuantity: 1,
        reservationQuantity: 1,
        activeReservationQuantity: 1,
        agreedUnitPriceCents: 1_500,
        originalSubtotalCents: 3_000,
        snapshot: null,
        priceExceptionReason: null,
        priceApprovedBy: null,
        allocatedCostCents: 1_000,
      },
    ],
    payments: [
      {
        id: 'payment-1',
        amountCents: 1_000,
        correctedCents: 0,
        netAmountCents: 1_000,
        method: 'cash',
        status: 'confirmed',
        registeredBy: 'employee-1',
        registrarUsername: 'employee',
        effectiveAt: new Date('2026-10-01T15:00:00.000Z'),
        corrections: [],
      },
    ],
    totalAdjustments: [],
    closure: null,
    returns: [],
    deliveries: [],
    cancellation: null,
    version: 3,
    confirmedAt: new Date('2026-10-01T14:00:00.000Z'),
    finalizedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-01T13:00:00.000Z'),
    updatedAt: new Date('2026-10-01T15:00:00.000Z'),
  };
}
