import type { InventoryClock, InventoryIdGenerator } from './inventory-dependencies';
import type { InventoryTransferBook, InventoryTransferResult } from './inventory-transfer-book';

export interface TransferInventoryCommand {
  operationId: string;
  productId: string;
  originLocationId: string;
  destinationLocationId: string;
  quantity: number;
  actorId: string;
}

export interface ForTransferringInventory {
  transfer(command: TransferInventoryCommand): Promise<InventoryTransferResult>;
}

export class TransferInventory implements ForTransferringInventory {
  constructor(
    private readonly transfers: InventoryTransferBook,
    private readonly idGenerator: InventoryIdGenerator,
    private readonly clock: InventoryClock,
  ) {}

  transfer(command: TransferInventoryCommand): Promise<InventoryTransferResult> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) {
      return Promise.resolve({ ok: false, reason: 'invalid-quantity' });
    }
    if (command.originLocationId === command.destinationLocationId) {
      return Promise.resolve({ ok: false, reason: 'same-location' });
    }
    return this.transfers.transfer({
      ...command,
      transferId: this.idGenerator.generate(),
      effectiveAt: this.clock.now(),
    });
  }
}
