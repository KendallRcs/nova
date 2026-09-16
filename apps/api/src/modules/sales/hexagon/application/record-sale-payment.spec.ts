import { describe, expect, it } from 'vitest';

import { RecordSalePayment } from './record-sale-payment';
import type { PreparedSalePayment, SalePaymentBook } from './sale-payment-book';

describe('RecordSalePayment', () => {
  it('prepares a valid payment using the application clock', async () => {
    let recorded: PreparedSalePayment | undefined;
    const payments: SalePaymentBook = {
      record: (command) => {
        recorded = command;
        return Promise.resolve({ ok: false, reason: 'sale-not-found' });
      },
    };
    const effectiveAt = new Date('2026-09-16T15:00:00.000Z');
    const result = await new RecordSalePayment(payments, { now: () => effectiveAt }).execute({
      operationId: 'operation-1',
      saleId: 'sale-1',
      expectedVersion: 2,
      actorId: 'employee-1',
      canRegisterAny: false,
      amountCents: 1_000,
      method: 'yape',
    });
    expect(result).toEqual({ ok: false, reason: 'sale-not-found' });
    expect(recorded).toMatchObject({ amountCents: 1_000, method: 'yape', effectiveAt });
  });

  it('rejects invalid amounts before reaching persistence', async () => {
    const payments: SalePaymentBook = {
      record: () => Promise.reject(new Error('must not be called')),
    };
    const result = await new RecordSalePayment(payments, { now: () => new Date() }).execute({
      operationId: 'operation-1',
      saleId: 'sale-1',
      expectedVersion: 2,
      actorId: 'employee-1',
      canRegisterAny: false,
      amountCents: 0,
      method: 'cash',
    });
    expect(result).toEqual({ ok: false, reason: 'invalid-payment' });
  });
});
