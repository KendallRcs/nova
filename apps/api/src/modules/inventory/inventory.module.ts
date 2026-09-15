import { Module } from '@nestjs/common';

import { PrismaInventoryCatalog } from './adapters/driven/prisma/prisma-inventory-catalog';
import { PrismaInventoryTransferBook } from './adapters/driven/prisma/prisma-inventory-transfer-book';
import {
  SystemInventoryClock,
  UuidV7InventoryIdGenerator,
} from './adapters/driven/system/system-inventory-dependencies';
import { InventoryController } from './adapters/driving/http/inventory.controller';
import {
  type InventoryCatalog,
  ListInventoryLocations,
} from './hexagon/application/inventory-catalog';
import type { InventoryTransferBook } from './hexagon/application/inventory-transfer-book';
import { TransferInventory } from './hexagon/application/transfer-inventory';

const INVENTORY_CATALOG = Symbol('INVENTORY_CATALOG');
const INVENTORY_TRANSFER_BOOK = Symbol('INVENTORY_TRANSFER_BOOK');

@Module({
  controllers: [InventoryController],
  providers: [
    PrismaInventoryCatalog,
    PrismaInventoryTransferBook,
    SystemInventoryClock,
    UuidV7InventoryIdGenerator,
    { provide: INVENTORY_CATALOG, useExisting: PrismaInventoryCatalog },
    { provide: INVENTORY_TRANSFER_BOOK, useExisting: PrismaInventoryTransferBook },
    {
      provide: ListInventoryLocations,
      inject: [INVENTORY_CATALOG],
      useFactory: (catalog: InventoryCatalog): ListInventoryLocations =>
        new ListInventoryLocations(catalog),
    },
    {
      provide: TransferInventory,
      inject: [INVENTORY_TRANSFER_BOOK, UuidV7InventoryIdGenerator, SystemInventoryClock],
      useFactory: (
        transfers: InventoryTransferBook,
        idGenerator: UuidV7InventoryIdGenerator,
        clock: SystemInventoryClock,
      ): TransferInventory => new TransferInventory(transfers, idGenerator, clock),
    },
  ],
})
export class InventoryModule {}
