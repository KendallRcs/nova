import { describe, expect, it } from 'vitest';

import type { CustomerAccountRecord, CustomerAccountSource } from './customer-account';
import { GetCustomerAccount } from './customer-account';

class FakeCustomerAccounts implements CustomerAccountSource {
  constructor(private readonly record: CustomerAccountRecord | null) {}

  findByCustomerId(): Promise<CustomerAccountRecord | null> {
    return Promise.resolve(this.record);
  }
}

describe('customer account', () => {
  it('consolidates active debt without treating finalized or cancelled sales as receivables', async () => {
    const account = new GetCustomerAccount(
      new FakeCustomerAccounts({
        customer: {
          id: 'customer-1',
          name: 'Ana',
          phone: '+51987654321',
          dni: null,
          address: null,
          mergedCustomerIds: ['customer-2'],
        },
        sales: [
          sale({
            id: 'sale-open',
            lifecycle: 'confirmed',
            total: 5_000,
            payments: [payment('payment-1', 1_500, '2026-09-10T10:00:00.000Z')],
            dueDate: '2026-09-15',
          }),
          sale({
            id: 'sale-finalized',
            lifecycle: 'finalized',
            total: 3_000,
            payments: [payment('payment-2', 2_000, '2026-09-12T10:00:00.000Z')],
            forgivenAmountCents: 1_000,
          }),
          sale({
            id: 'sale-cancelled',
            lifecycle: 'cancelled',
            total: 4_000,
            payments: [payment('payment-3', 1_500, '2026-09-13T10:00:00.000Z')],
            refundAmountsCents: [500],
          }),
        ],
      }),
      { now: () => new Date('2026-09-16T12:00:00.000Z') },
    );

    await expect(account.execute('customer-2')).resolves.toMatchObject({
      ok: true,
      account: {
        customer: { id: 'customer-1', mergedCustomerIds: ['customer-2'] },
        summary: {
          salesCount: 3,
          activeDebtSalesCount: 1,
          overdueSalesCount: 1,
          totalPaidCents: 4_500,
          totalOutstandingCents: 3_500,
          overdueAmountCents: 3_500,
          nearestDueDate: '2026-09-15',
          lastPaymentAt: new Date('2026-09-13T10:00:00.000Z'),
        },
        sales: [
          { id: 'sale-open', paidCents: 1_500, balanceCents: 3_500, overdue: true },
          { id: 'sale-finalized', paymentSituation: 'closed-with-balance' },
          { id: 'sale-cancelled', paidCents: 1_000, paymentSituation: 'not-applicable' },
        ],
      },
    });
  });

  it('reports an unknown customer without fabricating an empty account', async () => {
    await expect(
      new GetCustomerAccount(new FakeCustomerAccounts(null), {
        now: () => new Date('2026-09-16T12:00:00.000Z'),
      }).execute('missing'),
    ).resolves.toEqual({ ok: false, reason: 'customer-not-found' });
  });
});

function sale(input: {
  id: string;
  lifecycle: 'confirmed' | 'finalized' | 'cancelled';
  total: number;
  payments: ReturnType<typeof payment>[];
  dueDate?: string;
  refundAmountsCents?: number[];
  forgivenAmountCents?: number;
}): CustomerAccountRecord['sales'][number] {
  return {
    id: input.id,
    createdBy: 'employee-1',
    creatorUsername: 'empleado',
    lifecycle: input.lifecycle,
    originalTotalCents: input.total,
    currentTotalCents: input.total,
    dueDate: input.dueDate ?? null,
    paymentAmountsCents: input.payments.map(({ netAmountCents }) => netAmountCents),
    refundAmountsCents: input.refundAmountsCents ?? [],
    forgivenAmountCents: input.forgivenAmountCents ?? 0,
    lines: [{ quantity: 1, deliveredQuantity: 1 }],
    payments: input.payments,
    confirmedAt: new Date('2026-09-01T10:00:00.000Z'),
    finalizedAt: input.lifecycle === 'finalized' ? new Date('2026-09-14T10:00:00.000Z') : null,
    cancelledAt: input.lifecycle === 'cancelled' ? new Date('2026-09-14T10:00:00.000Z') : null,
  };
}

function payment(id: string, amountCents: number, effectiveAt: string) {
  return {
    id,
    amountCents,
    correctedCents: 0,
    netAmountCents: amountCents,
    method: 'cash' as const,
    registeredBy: 'employee-1',
    registrarUsername: 'empleado',
    effectiveAt: new Date(effectiveAt),
  };
}
