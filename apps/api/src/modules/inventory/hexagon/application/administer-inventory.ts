import type { InventoryClock, InventoryIdGenerator } from './inventory-dependencies';
import type {
  InventoryAdministrationBook,
  InventoryAdministrationResult,
  InventoryWriteOffCategory,
} from './inventory-administration-book';

export interface WriteOffInventoryCommand {
  operationId: string;
  productId: string;
  locationId: string;
  quantity: number;
  category: InventoryWriteOffCategory;
  reason: string;
  actorId: string;
}

export interface AdjustInventoryCountCommand {
  operationId: string;
  productId: string;
  locationId: string;
  observedPhysicalQuantity: number;
  expectedPositionVersion: number;
  declaredUnitCostCents: number | null;
  reason: string;
  actorId: string;
}

export class WriteOffInventory {
  constructor(
    private readonly book: InventoryAdministrationBook,
    private readonly ids: InventoryIdGenerator,
    private readonly clock: InventoryClock,
  ) {}

  execute(command: WriteOffInventoryCommand): Promise<InventoryAdministrationResult> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) {
      return Promise.resolve({ ok: false, reason: 'invalid-quantity' });
    }
    if (!WRITE_OFF_CATEGORIES.has(command.category)) {
      return Promise.resolve({ ok: false, reason: 'invalid-category' });
    }
    const reason = command.reason.trim();
    if (reason.length === 0) return Promise.resolve({ ok: false, reason: 'invalid-reason' });
    return this.book.execute({
      ...command,
      reason,
      kind: 'write-off',
      movementId: this.ids.generate(),
      costMovementId: this.ids.generate(),
      effectiveAt: this.clock.now(),
    });
  }
}

export class AdjustInventoryCount {
  constructor(
    private readonly book: InventoryAdministrationBook,
    private readonly ids: InventoryIdGenerator,
    private readonly clock: InventoryClock,
  ) {}

  execute(command: AdjustInventoryCountCommand): Promise<InventoryAdministrationResult> {
    if (
      !Number.isSafeInteger(command.observedPhysicalQuantity) ||
      command.observedPhysicalQuantity < 0 ||
      !Number.isSafeInteger(command.expectedPositionVersion) ||
      command.expectedPositionVersion < 0
    ) {
      return Promise.resolve({ ok: false, reason: 'invalid-count' });
    }
    if (
      command.declaredUnitCostCents !== null &&
      (!Number.isSafeInteger(command.declaredUnitCostCents) || command.declaredUnitCostCents < 0)
    ) {
      return Promise.resolve({ ok: false, reason: 'invalid-unit-cost' });
    }
    const reason = command.reason.trim();
    if (reason.length === 0) return Promise.resolve({ ok: false, reason: 'invalid-reason' });
    return this.book.execute({
      ...command,
      reason,
      kind: 'count-adjustment',
      movementId: this.ids.generate(),
      costMovementId: this.ids.generate(),
      effectiveAt: this.clock.now(),
    });
  }
}

const WRITE_OFF_CATEGORIES = new Set<InventoryWriteOffCategory>([
  'damaged',
  'lost',
  'defective',
  'other',
]);
