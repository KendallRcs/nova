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

  it('delivers a reservation partially and preserves the original sale total', () => {
    const sale = confirmedReservedSale();
    expect(
      sale.deliver({
        delivery: delivery('delivery-1', 1, 250),
        actorId: 'employee-1',
        canDeliverAny: false,
        now: new Date('2026-09-16T10:00:00.000Z'),
      }),
    ).toEqual({ ok: true, deliveredQuantity: 1, remainingReservedQuantity: 1 });
    expect(sale.toPrimitives()).toMatchObject({
      currentTotalCents: 3_000,
      version: 3,
      deliveries: [{ id: 'delivery-1', lines: [{ quantity: 1, consumedCostCents: 250 }] }],
    });
  });

  it('rejects a foreign employee and a delivery above the pending reservation', () => {
    const sale = confirmedReservedSale();
    expect(
      sale.deliver({
        delivery: delivery('delivery-1', 1, 250),
        actorId: 'employee-2',
        canDeliverAny: false,
        now: new Date(),
      }),
    ).toEqual({ ok: false, reason: 'not-owner' });
    expect(
      sale.deliver({
        delivery: delivery('delivery-2', 3, 750),
        actorId: 'admin-1',
        canDeliverAny: true,
        now: new Date(),
      }),
    ).toEqual({
      ok: false,
      reason: 'quantity-exceeds-reserved',
      saleLineId: 'line-reserved',
      deliverableQuantity: 2,
    });
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

  it('reduces an unpaid sale without refunding while a balance remains', () => {
    const sale = returnableSale(5_000);

    expect(
      sale.approveReturn({
        saleReturn: saleReturn('return-1', 'line-b', null),
        canApprove: true,
        now: new Date('2026-09-16T12:00:00.000Z'),
      }),
    ).toEqual({
      ok: true,
      commercialReductionCents: 4_000,
      refundAmountCents: 0,
      currentTotalCents: 6_000,
      paidCents: 5_000,
      balanceCents: 1_000,
    });
    expect(sale.toPrimitives().returns[0]).toMatchObject({
      refundMethod: null,
      lines: [{ attributedCostCents: 2_000 }],
    });
  });

  it('refunds exactly the paid excess after reducing the commercial total', () => {
    const sale = returnableSale(8_000);

    expect(
      sale.approveReturn({
        saleReturn: saleReturn('return-1', 'line-b', 'yape'),
        canApprove: true,
        now: new Date('2026-09-16T12:00:00.000Z'),
      }),
    ).toEqual({
      ok: true,
      commercialReductionCents: 4_000,
      refundAmountCents: 2_000,
      currentTotalCents: 6_000,
      paidCents: 6_000,
      balanceCents: 0,
    });
  });

  it('does not permit returning more units than were delivered', () => {
    const sale = returnableSale(0);
    expect(
      sale.approveReturn({
        saleReturn: saleReturn('return-1', 'line-a', null),
        canApprove: true,
        now: new Date('2026-09-16T12:00:00.000Z'),
      }).ok,
    ).toBe(true);

    expect(
      sale.approveReturn({
        saleReturn: saleReturn('return-2', 'line-a', null),
        canApprove: true,
        now: new Date('2026-09-16T13:00:00.000Z'),
      }),
    ).toEqual({
      ok: false,
      reason: 'quantity-exceeds-delivered',
      saleLineId: 'line-a',
      returnableQuantity: 0,
    });
  });

  it('cancels with the exact manually declared refund and explicit product treatment', () => {
    const sale = returnableSale(8_000);

    expect(
      sale.cancel({
        cancellation: cancellation(3_000, 'cash'),
        canCancel: true,
        now: new Date('2026-09-16T14:00:00.000Z'),
      }),
    ).toEqual({
      ok: true,
      refundAmountCents: 3_000,
      paidCents: 5_000,
      releasedQuantity: 0,
      returnedQuantity: 1,
      notReturnedQuantity: 1,
    });
    expect(sale.toPrimitives()).toMatchObject({
      lifecycle: 'cancelled',
      version: 3,
      cancellation: {
        refundAmountCents: 3_000,
        refundMethod: 'cash',
        lines: [
          { saleLineId: 'line-a', attributedReturnedCostCents: 3_000 },
          { saleLineId: 'line-b', attributedReturnedCostCents: 0 },
        ],
      },
    });
  });

  it('allows cancellation without refund and rejects a refund above net paid', () => {
    const excessive = returnableSale(5_000);
    expect(
      excessive.cancel({
        cancellation: cancellation(5_001, 'yape'),
        canCancel: true,
        now: new Date('2026-09-16T14:00:00.000Z'),
      }),
    ).toEqual({ ok: false, reason: 'refund-exceeds-paid', paidCents: 5_000 });

    const withoutRefund = returnableSale(5_000);
    expect(
      withoutRefund.cancel({
        cancellation: cancellation(0, null),
        canCancel: true,
        now: new Date('2026-09-16T14:00:00.000Z'),
      }),
    ).toMatchObject({ ok: true, refundAmountCents: 0, paidCents: 5_000 });
  });
});

function cancellation(
  refundAmountCents: number,
  refundMethod: 'cash' | 'yape' | 'plin' | 'pos' | null,
) {
  return {
    id: 'cancellation-1',
    reason: 'Acuerdo de cancelación con el cliente',
    refundAmountCents,
    refundMethod,
    cancelledBy: 'admin-1',
    effectiveAt: new Date('2026-09-16T14:00:00.000Z'),
    lines: [
      {
        id: 'cancellation-line-a',
        saleLineId: 'line-a',
        releasedQuantity: 0,
        returnedQuantity: 1,
        notReturnedQuantity: 0,
        returnLocationId: 'location-1',
        condition: 'available' as const,
        releasedCostCents: 0,
      },
      {
        id: 'cancellation-line-b',
        saleLineId: 'line-b',
        releasedQuantity: 0,
        returnedQuantity: 0,
        notReturnedQuantity: 1,
        returnLocationId: null,
        condition: null,
        releasedCostCents: 0,
      },
    ],
  };
}

function returnableSale(initialPaymentCents: number): Sale {
  const created = Sale.createDraft({
    id: 'sale-returnable',
    createdBy: 'employee-1',
    customerId: 'customer-1',
    lines: [
      line('line-a', 'product-a', 1, 6_000, 1, 0),
      line('line-b', 'product-b', 1, 4_000, 1, 0),
    ],
    now: new Date('2026-09-15T20:00:00.000Z'),
  });
  if (!created.ok) throw new Error(created.reason);
  const confirmed = created.sale.confirm({
    customerId: 'customer-1',
    productSnapshots: new Map([
      [
        'product-a',
        {
          code: 'A',
          name: 'Producto A',
          minimumPriceCents: 6_000,
          suggestedPriceCents: null,
          maximumPriceCents: null,
        },
      ],
      [
        'product-b',
        {
          code: 'B',
          name: 'Producto B',
          minimumPriceCents: 4_000,
          suggestedPriceCents: null,
          maximumPriceCents: null,
        },
      ],
    ]),
    priceExceptionReasons: new Map(),
    confirmedBy: 'employee-1',
    canApprovePriceException: false,
    initialPayment:
      initialPaymentCents === 0 ? null : payment('payment-returnable', initialPaymentCents),
    now: new Date('2026-09-15T21:00:00.000Z'),
  });
  if (!confirmed.ok) throw new Error(confirmed.reason);
  created.sale.attributeConfirmedCost('line-a', 3_000);
  created.sale.attributeConfirmedCost('line-b', 2_000);
  return created.sale;
}

function saleReturn(
  id: string,
  saleLineId: string,
  refundMethod: 'cash' | 'yape' | 'plin' | 'pos' | null,
) {
  return {
    id,
    reason: 'Cliente cambió de opinión',
    refundMethod,
    approvedBy: 'admin-1',
    effectiveAt: new Date('2026-09-16T12:00:00.000Z'),
    lines: [
      {
        id: `${id}-line`,
        saleLineId,
        quantity: 1,
        productReturns: false,
        returnLocationId: null,
        condition: null,
      },
    ],
  };
}

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

function confirmedReservedSale(): Sale {
  const result = Sale.createDraft({
    id: 'sale-reserved',
    createdBy: 'employee-1',
    customerId: 'customer-1',
    lines: [line('line-reserved', 'product-1', 2, 1_500, 0, 2)],
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
  result.sale.attributeConfirmedCost('line-reserved', 500);
  return result.sale;
}

function delivery(id: string, quantity: number, consumedCostCents: number) {
  return {
    id,
    deliveredBy: 'employee-1',
    effectiveAt: new Date('2026-09-16T10:00:00.000Z'),
    lines: [
      {
        id: `${id}-line`,
        saleLineId: 'line-reserved',
        locationId: 'location-1',
        quantity,
        consumedCostCents,
      },
    ],
  };
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
