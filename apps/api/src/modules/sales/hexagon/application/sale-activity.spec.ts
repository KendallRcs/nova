import { describe, expect, it } from 'vitest';

import { ListSales, type SaleActivityRecord, type SaleActivitySource } from './sale-activity';

describe('ListSales', () => {
  it('limits an employee to owned sales and derives overdue debt in Lima', async () => {
    let requestedCreator: string | undefined;
    const source: SaleActivitySource = {
      find: (input) => {
        requestedCreator = input.createdBy;
        return Promise.resolve([record('sale-1')]);
      },
    };
    const page = await new ListSales(source, {
      now: () => new Date('2026-09-16T05:01:00.000Z'),
    }).execute({
      actorId: 'employee-1',
      canReadAny: false,
      createdBy: 'employee-2',
      debt: 'overdue',
      limit: 50,
    });
    expect(requestedCreator).toBe('employee-1');
    expect(page.items).toMatchObject([
      { id: 'sale-1', paidCents: 500, balanceCents: 1_500, overdue: true },
    ]);
  });

  it('allows an administrator to filter another creator', async () => {
    let requestedCreator: string | undefined;
    const source: SaleActivitySource = {
      find: (input) => {
        requestedCreator = input.createdBy;
        return Promise.resolve([]);
      },
    };
    await new ListSales(source, { now: () => new Date() }).execute({
      actorId: 'admin-1',
      canReadAny: true,
      createdBy: 'employee-2',
      debt: 'all',
      limit: 50,
    });
    expect(requestedCreator).toBe('employee-2');
  });
});

function record(id: string): SaleActivityRecord {
  return {
    id,
    createdBy: 'employee-1',
    creatorUsername: 'empleado',
    customer: {
      historicalId: 'customer-1',
      canonicalId: 'customer-1',
      name: 'Cliente',
      phone: '+51987654321',
    },
    lifecycle: 'confirmed',
    originalTotalCents: 2_000,
    currentTotalCents: 2_000,
    dueDate: '2026-09-15',
    paymentAmountsCents: [500],
    forgivenAmountCents: 0,
    lines: [{ quantity: 2, deliveredQuantity: 1 }],
    version: 3,
    confirmedAt: new Date('2026-09-15T20:00:00.000Z'),
    createdAt: new Date('2026-09-15T19:00:00.000Z'),
    updatedAt: new Date('2026-09-15T20:00:00.000Z'),
  };
}
