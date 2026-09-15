import { describe, expect, it } from 'vitest';

import type { InventoryClock, InventoryIdGenerator } from './inventory-dependencies';
import type {
  InventoryTransferBook,
  InventoryTransferResult,
  PreparedInventoryTransfer,
} from './inventory-transfer-book';
import { TransferInventory } from './transfer-inventory';

class RecordingTransferBook implements InventoryTransferBook {
  commands: PreparedInventoryTransfer[] = [];

  transfer(command: PreparedInventoryTransfer): Promise<InventoryTransferResult> {
    this.commands.push(command);
    return Promise.resolve({ ok: false, reason: 'insufficient-stock', availableQuantity: 2 });
  }
}

const command = {
  operationId: 'operation-1',
  productId: 'product-1',
  originLocationId: 'store',
  destinationLocationId: 'warehouse',
  quantity: 3,
  actorId: 'admin-1',
};
const ids: InventoryIdGenerator = { generate: () => 'transfer-1' };
const clock: InventoryClock = { now: () => new Date('2026-09-15T17:00:00.000Z') };

describe('TransferInventory', () => {
  it('prepares an auditable transfer and delegates its atomic persistence', async () => {
    const book = new RecordingTransferBook();
    await expect(new TransferInventory(book, ids, clock).transfer(command)).resolves.toEqual({
      ok: false,
      reason: 'insufficient-stock',
      availableQuantity: 2,
    });
    expect(book.commands).toEqual([
      {
        ...command,
        transferId: 'transfer-1',
        effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
      },
    ]);
  });

  it('rejects invalid requests before touching persistence', async () => {
    const book = new RecordingTransferBook();
    const transfers = new TransferInventory(book, ids, clock);
    await expect(transfers.transfer({ ...command, quantity: 0 })).resolves.toEqual({
      ok: false,
      reason: 'invalid-quantity',
    });
    await expect(
      transfers.transfer({ ...command, destinationLocationId: command.originLocationId }),
    ).resolves.toEqual({ ok: false, reason: 'same-location' });
    expect(book.commands).toEqual([]);
  });
});
