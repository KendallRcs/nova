import { describe, expect, it } from 'vitest';

import type { InventoryClock, InventoryIdGenerator } from './inventory-dependencies';
import type {
  InventoryAdministrationBook,
  InventoryAdministrationResult,
  PreparedInventoryAdministrationCommand,
} from './inventory-administration-book';
import { AdjustInventoryCount, WriteOffInventory } from './administer-inventory';

class RecordingBook implements InventoryAdministrationBook {
  commands: PreparedInventoryAdministrationCommand[] = [];
  execute(command: PreparedInventoryAdministrationCommand): Promise<InventoryAdministrationResult> {
    this.commands.push(command);
    return Promise.resolve({ ok: false, reason: 'product-not-found' });
  }
}

const generated = ['movement-1', 'cost-movement-1'];
const ids: InventoryIdGenerator = { generate: () => generated.shift() ?? 'unexpected' };
const clock: InventoryClock = { now: () => new Date('2026-09-15T17:00:00.000Z') };

describe('inventory administration use cases', () => {
  it('prepares a normalized and auditable write-off', async () => {
    const book = new RecordingBook();
    await new WriteOffInventory(book, ids, clock).execute({
      operationId: 'operation-1',
      productId: 'product-1',
      locationId: 'store',
      quantity: 2,
      category: 'damaged',
      reason: '  caja rota  ',
      actorId: 'admin-1',
    });
    expect(book.commands[0]).toMatchObject({
      kind: 'write-off',
      movementId: 'movement-1',
      costMovementId: 'cost-movement-1',
      reason: 'caja rota',
      effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
    });
  });

  it('rejects an invalid adjustment before persistence', async () => {
    const book = new RecordingBook();
    const result = await new AdjustInventoryCount(book, ids, clock).execute({
      operationId: 'operation-1',
      productId: 'product-1',
      locationId: 'store',
      observedPhysicalQuantity: -1,
      expectedPositionVersion: 0,
      declaredUnitCostCents: null,
      reason: 'conteo',
      actorId: 'admin-1',
    });
    expect(result).toEqual({ ok: false, reason: 'invalid-count' });
    expect(book.commands).toEqual([]);
  });
});
