import { describe, expect, it } from 'vitest';

import {
  GetPurchaseDetail,
  ListPurchases,
  type PurchaseDetail,
  type PurchaseHistoryDirectory,
} from './purchase-history';

const purchase: PurchaseDetail = {
  id: 'purchase-1',
  operationId: 'operation-1',
  supplier: { id: 'supplier-1', name: 'Proveedor', kind: 'registered' },
  totalCents: 2_000,
  advanceAppliedCents: 500,
  newlyPaidCents: 1_500,
  paymentMethod: 'cash',
  lineCount: 1,
  totalQuantity: 2,
  createdBy: 'user-1',
  creatorUsername: 'admin',
  confirmedBy: 'user-1',
  confirmerUsername: 'admin',
  effectiveAt: new Date('2026-10-19T18:00:00.000Z'),
  createdAt: new Date('2026-10-19T18:00:00.000Z'),
  lines: [],
  advanceApplications: [],
};

function directory(): PurchaseHistoryDirectory {
  return {
    list: (input) =>
      Promise.resolve({
        items: input.supplierId === 'supplier-1' ? [purchase] : [],
        nextPurchaseId: null,
      }),
    findById: (purchaseId) => Promise.resolve(purchaseId === purchase.id ? purchase : null),
  };
}

describe('purchase history queries', () => {
  it('lists purchases through the provider-free directory contract', async () => {
    await expect(
      new ListPurchases(directory()).execute({ supplierId: 'supplier-1', limit: 50 }),
    ).resolves.toMatchObject({ items: [{ id: 'purchase-1' }], nextPurchaseId: null });
  });

  it('returns a purchase detail or an explicit not-found result', async () => {
    const query = new GetPurchaseDetail(directory());
    await expect(query.execute('purchase-1')).resolves.toEqual({ ok: true, purchase });
    await expect(query.execute('missing')).resolves.toEqual({
      ok: false,
      reason: 'purchase-not-found',
    });
  });
});
