import { describe, expect, it } from 'vitest';

import { prepareExpense, prepareExpenseCancellation } from './expense';

describe('operating expense rules', () => {
  it('normalizes optional text while requiring a positive amount', () => {
    expect(prepareExpense({ amountCents: 2_500, description: '  Movilidad  ' })).toEqual({
      ok: true,
      description: 'Movilidad',
      receiptStorageKey: null,
    });
    expect(prepareExpense({ amountCents: 0 })).toEqual({ ok: false, reason: 'invalid-amount' });
  });

  it('allows cancellation without refund and preserves a zero refund', () => {
    expect(
      prepareExpenseCancellation({
        expenseAmountCents: 2_500,
        reason: 'Registro duplicado',
        refundReceived: false,
      }),
    ).toEqual({
      ok: true,
      reason: 'Registro duplicado',
      refundAmountCents: 0,
      refundMethod: null,
    });
  });

  it('turns a declared refund into the full original amount', () => {
    expect(
      prepareExpenseCancellation({
        expenseAmountCents: 2_500,
        reason: 'Servicio cancelado',
        refundReceived: true,
        refundMethod: 'yape',
      }),
    ).toMatchObject({ ok: true, refundAmountCents: 2_500, refundMethod: 'yape' });
  });
});
