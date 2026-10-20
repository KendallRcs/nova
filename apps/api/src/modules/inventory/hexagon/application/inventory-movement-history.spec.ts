import { describe, expect, it } from 'vitest';

import {
  ListInventoryMovements,
  type InventoryMovementRecord,
  type InventoryMovementSource,
} from './inventory-movement-history';

const movement: InventoryMovementRecord = {
  id: 'movement-1',
  product: { id: 'product-1', currentCode: 'PEL-001', currentName: 'Peluche' },
  location: { id: 'location-1', code: 'STORE', name: 'Tienda', type: 'store' },
  type: 'reservation',
  physicalDelta: 0,
  reservedDelta: 2,
  reviewDelta: 0,
  previous: { physicalQuantity: 5, reservedQuantity: 0, reviewQuantity: 1 },
  resulting: { physicalQuantity: 5, reservedQuantity: 2, reviewQuantity: 1 },
  actor: { id: 'actor-1', username: 'empleado' },
  effectiveAt: new Date('2026-10-19T18:00:00.000Z'),
  reason: null,
  administrativeCategory: null,
  references: {
    operationId: null,
    transferId: null,
    saleId: 'sale-1',
    saleLineId: 'sale-line-1',
    returnId: null,
    returnLineId: null,
    cancellationId: null,
    cancellationLineId: null,
    deliveryId: null,
    deliveryLineId: null,
    purchaseId: null,
    purchaseLineId: null,
    initialImportId: null,
  },
};

describe('ListInventoryMovements', () => {
  it('derives availability before and after without exposing cost data', async () => {
    const source: InventoryMovementSource = {
      list: () => Promise.resolve({ items: [movement], nextMovementId: null }),
    };
    await expect(new ListInventoryMovements(source).execute({ limit: 50 })).resolves.toMatchObject({
      items: [
        {
          previous: { availableQuantity: 4 },
          resulting: { availableQuantity: 2 },
          references: { saleId: 'sale-1' },
        },
      ],
      nextMovementId: null,
    });
  });
});
