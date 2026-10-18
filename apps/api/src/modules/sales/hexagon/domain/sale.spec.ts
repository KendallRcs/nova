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

  it('requires a customer for the unpaid balance and admin approval below minimum', () => {
    const result = Sale.createDraft({
      id: 'sale-1',
      createdBy: 'employee-1',
      customerId: null,
      lines: [line('line-1', 'product-1', 1, 50, 1, 0)],
      now: new Date(),
    });
    if (!result.ok) throw new Error(result.reason);
    const snapshots = new Map([
      [
        'product-1',
        {
          code: 'P-1',
          name: 'Producto',
          minimumPriceCents: 100,
          suggestedPriceCents: null,
          maximumPriceCents: null,
        },
      ],
    ]);
    expect(
      result.sale.confirm({
        customerId: null,
        productSnapshots: snapshots,
        priceExceptionReasons: new Map(),
        confirmedBy: 'admin-1',
        canApprovePriceException: true,
        initialPayment: null,
        now: new Date(),
      }),
    ).toEqual({ ok: false, reason: 'customer-required' });
    expect(
      result.sale.confirm({
        customerId: 'customer-1',
        productSnapshots: snapshots,
        priceExceptionReasons: new Map([['line-1', 'Remate por defecto']]),
        confirmedBy: 'admin-1',
        canApprovePriceException: true,
        initialPayment: null,
        now: new Date('2026-09-15T21:00:00.000Z'),
      }),
    ).toEqual({ ok: true });
    expect(result.sale.toPrimitives()).toMatchObject({
      lifecycle: 'confirmed',
      version: 2,
      lines: [{ priceApprovedBy: 'admin-1', priceExceptionReason: 'Remate por defecto' }],
    });
  });

  it('allows a cash sale without customer when the initial payment covers the total', () => {
    const result = Sale.createDraft({
      id: 'sale-1',
      createdBy: 'employee-1',
      lines: [line('line-1', 'product-1', 1, 1_500, 1, 0)],
      now: new Date('2026-09-15T20:00:00.000Z'),
    });
    if (!result.ok) throw new Error(result.reason);
    expect(
      result.sale.confirm({
        customerId: null,
        productSnapshots: new Map([
          [
            'product-1',
            {
              code: 'P-1',
              name: 'Producto',
              minimumPriceCents: 1_000,
              suggestedPriceCents: null,
              maximumPriceCents: null,
            },
          ],
        ]),
        priceExceptionReasons: new Map(),
        confirmedBy: 'employee-1',
        canApprovePriceException: false,
        initialPayment: {
          id: 'payment-1',
          amountCents: 1_500,
          method: 'cash',
          registeredBy: 'employee-1',
          effectiveAt: new Date('2026-09-15T21:00:00.000Z'),
        },
        now: new Date('2026-09-15T21:00:00.000Z'),
      }),
    ).toEqual({ ok: true });
    expect(result.sale.balanceCents()).toBe(0);
  });

  it('registers payments without exceeding the balance or allowing a foreign employee', () => {
    const sale = confirmedSale();
    expect(
      sale.registerPayment({
        payment: payment('payment-1', 600),
        actorId: 'employee-2',
        canRegisterAny: false,
        now: new Date('2026-09-16T10:00:00.000Z'),
      }),
    ).toEqual({ ok: false, reason: 'not-owner' });
    expect(
      sale.registerPayment({
        payment: payment('payment-1', 600),
        actorId: 'employee-1',
        canRegisterAny: false,
        now: new Date('2026-09-16T10:00:00.000Z'),
      }),
    ).toEqual({ ok: true, paidCents: 600, balanceCents: 900, paymentSituation: 'partial' });
    expect(
      sale.registerPayment({
        payment: payment('payment-2', 901),
        actorId: 'employee-1',
        canRegisterAny: false,
        now: new Date('2026-09-16T10:01:00.000Z'),
      }),
    ).toEqual({ ok: false, reason: 'payment-exceeds-balance', balanceCents: 900 });
  });

  it('preserves the financial audit trail when adjusting, correcting and closing with balance', () => {
    const sale = confirmedSale();
    const paid = sale.registerPayment({
      payment: payment('payment-1', 600),
      actorId: 'employee-1',
      canRegisterAny: false,
      now: new Date('2026-09-16T10:00:00.000Z'),
    });
    expect(paid.ok).toBe(true);

    expect(
      sale.adjustTotal({
        adjustment: {
          id: 'adjustment-1',
          newTotalCents: 1_800,
          reason: 'Acuerdo final con el cliente',
          changedBy: 'admin-1',
          effectiveAt: new Date('2026-09-16T11:00:00.000Z'),
        },
        canAdjust: true,
        now: new Date('2026-09-16T11:00:00.000Z'),
      }),
    ).toMatchObject({ ok: true, previousTotalCents: 1_500, differenceCents: 300 });

    expect(
      sale.correctPayment({
        paymentId: 'payment-1',
        amountCents: 200,
        reason: 'Cobro duplicado',
        canCorrect: true,
        now: new Date('2026-09-16T12:00:00.000Z'),
      }),
    ).toEqual({
      ok: true,
      correctedCents: 200,
      remainingCorrectableCents: 400,
      paidCents: 400,
      balanceCents: 1_400,
    });

    expect(
      sale.finalize({
        closure: {
          id: 'closure-1',
          reason: 'Se acuerda no cobrar el saldo restante',
          closedBy: 'admin-1',
          effectiveAt: new Date('2026-09-16T13:00:00.000Z'),
        },
        canFinalize: true,
        now: new Date('2026-09-16T13:00:00.000Z'),
      }),
    ).toEqual({ ok: true, closureType: 'incomplete', forgivenAmountCents: 1_400 });
    expect(sale.toPrimitives()).toMatchObject({
      lifecycle: 'finalized',
      currentTotalCents: 1_800,
      version: 6,
      payments: [{ correctedCents: 200 }],
      totalAdjustments: [{ previousTotalCents: 1_500, newTotalCents: 1_800 }],
      closure: { type: 'incomplete', forgivenAmountCents: 1_400 },
    });
    expect(sale.balanceCents()).toBe(0);
  });

  it('does not allow the adjusted total below the net amount already paid', () => {
    const sale = confirmedSale();
    sale.registerPayment({
      payment: payment('payment-1', 600),
      actorId: 'employee-1',
      canRegisterAny: false,
      now: new Date(),
    });
    expect(
      sale.adjustTotal({
        adjustment: {
          id: 'adjustment-1',
          newTotalCents: 599,
          reason: 'Monto final',
          changedBy: 'admin-1',
          effectiveAt: new Date(),
        },
        canAdjust: true,
        now: new Date(),
      }),
    ).toEqual({ ok: false, reason: 'total-below-paid', paidCents: 600 });
  });
});

function confirmedSale(): Sale {
  const result = Sale.createDraft({
    id: 'sale-1',
    createdBy: 'employee-1',
    customerId: 'customer-1',
    lines: [line('line-1', 'product-1', 1, 1_500, 1, 0)],
    now: new Date('2026-09-15T20:00:00.000Z'),
  });
  if (!result.ok) throw new Error(result.reason);
  const confirmed = result.sale.confirm({
    customerId: 'customer-1',
    productSnapshots: new Map([
      [
        'product-1',
        {
          code: 'P-1',
          name: 'Producto',
          minimumPriceCents: 1_000,
          suggestedPriceCents: null,
          maximumPriceCents: null,
        },
      ],
    ]),
    priceExceptionReasons: new Map(),
    confirmedBy: 'employee-1',
    canApprovePriceException: false,
    initialPayment: null,
    now: new Date('2026-09-15T21:00:00.000Z'),
  });
  if (!confirmed.ok) throw new Error(confirmed.reason);
  return result.sale;
}

function payment(id: string, amountCents: number) {
  return {
    id,
    amountCents,
    method: 'yape' as const,
    registeredBy: 'employee-1',
    effectiveAt: new Date('2026-09-16T10:00:00.000Z'),
  };
}

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
