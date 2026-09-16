import { describe, expect, it } from 'vitest';

import { CreateSaleDraft, UpdateSaleDraft } from './manage-sale-drafts';
import type { SaleDraftReferences, SaleDraftRepository } from './sale-draft.repository';
import type { Sale } from '../domain/sale';

class MemorySaleDrafts implements SaleDraftRepository {
  readonly sales = new Map<string, Sale>();
  findById(id: string) {
    return Promise.resolve(this.sales.get(id) ?? null);
  }
  create(sale: Sale) {
    this.sales.set(sale.toPrimitives().id, sale);
    return Promise.resolve();
  }
  update(sale: Sale, expectedVersion: number) {
    const current = this.sales.get(sale.toPrimitives().id);
    if (current?.toPrimitives().version !== expectedVersion + 1) {
      return Promise.resolve(false);
    }
    this.sales.set(sale.toPrimitives().id, sale);
    return Promise.resolve(true);
  }
}

const references: SaleDraftReferences = {
  validate: ({ customerId }) =>
    Promise.resolve({
      ok: true,
      canonicalCustomerId: customerId === 'merged' ? 'primary' : customerId,
    }),
};

describe('Manage sale drafts', () => {
  it('creates a draft for the authenticated employee and resolves the canonical customer', async () => {
    const repository = new MemorySaleDrafts();
    const result = await new CreateSaleDraft(
      repository,
      references,
      sequentialIds(),
      fixedClock(),
    ).execute({ actorId: 'employee-1', customerId: 'merged', lines: [line()] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.toPrimitives()).toMatchObject({
      id: 'id-1',
      createdBy: 'employee-1',
      customerId: 'primary',
      version: 1,
    });
  });

  it('prevents an employee from editing another employee draft', async () => {
    const repository = new MemorySaleDrafts();
    await new CreateSaleDraft(repository, references, sequentialIds(), fixedClock()).execute({
      actorId: 'employee-1',
      lines: [line()],
    });
    const result = await new UpdateSaleDraft(
      repository,
      references,
      sequentialIds(),
      fixedClock(),
    ).execute({
      saleId: 'id-1',
      actorId: 'employee-2',
      canEditAny: false,
      expectedVersion: 1,
      lines: [line()],
    });
    expect(result).toEqual({ ok: false, reason: 'not-owner' });
  });

  it('allows an administrator to replace a draft using the observed version', async () => {
    const repository = new MemorySaleDrafts();
    await new CreateSaleDraft(repository, references, sequentialIds(), fixedClock()).execute({
      actorId: 'employee-1',
      lines: [line()],
    });
    const result = await new UpdateSaleDraft(
      repository,
      references,
      sequentialIds(),
      fixedClock(),
    ).execute({
      saleId: 'id-1',
      actorId: 'admin-1',
      canEditAny: true,
      expectedVersion: 1,
      dueDate: '2026-10-01',
      lines: [{ ...line(), quantity: 2 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sale.toPrimitives()).toMatchObject({ version: 2, dueDate: '2026-10-01' });
  });
});

function sequentialIds() {
  let value = 0;
  return { generate: () => `id-${String(++value)}` };
}
function fixedClock() {
  return { now: () => new Date('2026-09-15T20:00:00.000Z') };
}
function line() {
  return {
    productId: 'product-1',
    locationId: 'location-1',
    quantity: 1,
    deliveryQuantity: 1,
    reservationQuantity: 0,
    agreedUnitPriceCents: 1_500,
  };
}
