export type InventoryMovementKind =
  | 'opening'
  | 'purchase-in'
  | 'reservation'
  | 'release'
  | 'delivery'
  | 'return-review'
  | 'return-available'
  | 'transfer-out'
  | 'transfer-in'
  | 'write-off'
  | 'adjustment-in'
  | 'adjustment-out';

export type InventoryMovementCategory = 'damaged' | 'lost' | 'defective' | 'other';

export interface InventoryMovementBalance {
  readonly physicalQuantity: number;
  readonly reservedQuantity: number;
  readonly reviewQuantity: number;
}

export interface InventoryMovementRecord {
  readonly id: string;
  readonly product: {
    readonly id: string;
    readonly currentCode: string;
    readonly currentName: string;
  };
  readonly location: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly type: 'store' | 'warehouse';
  };
  readonly type: InventoryMovementKind;
  readonly physicalDelta: number;
  readonly reservedDelta: number;
  readonly reviewDelta: number;
  readonly previous: InventoryMovementBalance;
  readonly resulting: InventoryMovementBalance;
  readonly actor: { readonly id: string; readonly username: string };
  readonly effectiveAt: Date;
  readonly reason: string | null;
  readonly administrativeCategory: InventoryMovementCategory | null;
  readonly references: {
    readonly operationId: string | null;
    readonly transferId: string | null;
    readonly saleId: string | null;
    readonly saleLineId: string | null;
    readonly returnId: string | null;
    readonly returnLineId: string | null;
    readonly cancellationId: string | null;
    readonly cancellationLineId: string | null;
    readonly deliveryId: string | null;
    readonly deliveryLineId: string | null;
    readonly purchaseId: string | null;
    readonly purchaseLineId: string | null;
    readonly initialImportId: string | null;
  };
}

export interface InventoryMovementView extends Omit<
  InventoryMovementRecord,
  'previous' | 'resulting'
> {
  readonly previous: InventoryMovementBalance & { readonly availableQuantity: number };
  readonly resulting: InventoryMovementBalance & { readonly availableQuantity: number };
}

export interface InventoryMovementPage {
  readonly items: readonly InventoryMovementView[];
  readonly nextMovementId: string | null;
}

export interface InventoryMovementSource {
  list(input: {
    productId?: string;
    locationId?: string;
    actorId?: string;
    type?: InventoryMovementKind;
    afterMovementId?: string;
    limit: number;
  }): Promise<{
    readonly items: readonly InventoryMovementRecord[];
    readonly nextMovementId: string | null;
  }>;
}

export class ListInventoryMovements {
  constructor(private readonly source: InventoryMovementSource) {}

  async execute(
    input: Parameters<InventoryMovementSource['list']>[0],
  ): Promise<InventoryMovementPage> {
    const page = await this.source.list(input);
    return {
      items: page.items.map((movement) => ({
        ...movement,
        previous: withAvailability(movement.previous),
        resulting: withAvailability(movement.resulting),
      })),
      nextMovementId: page.nextMovementId,
    };
  }
}

function withAvailability(balance: InventoryMovementBalance) {
  return {
    ...balance,
    availableQuantity: balance.physicalQuantity - balance.reservedQuantity - balance.reviewQuantity,
  };
}
