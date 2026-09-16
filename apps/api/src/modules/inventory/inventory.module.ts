import { Module } from '@nestjs/common';

import { PrismaInventoryCatalog } from './adapters/driven/prisma/prisma-inventory-catalog';
import { PrismaInventoryTransferBook } from './adapters/driven/prisma/prisma-inventory-transfer-book';
import { PrismaInventoryAdministrationBook } from './adapters/driven/prisma/prisma-inventory-administration-book';
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
import type { InventoryAdministrationBook } from './hexagon/application/inventory-administration-book';
import {
  AdjustInventoryCount,
  WriteOffInventory,
} from './hexagon/application/administer-inventory';
import { TransferInventory } from './hexagon/application/transfer-inventory';

const INVENTORY_CATALOG = Symbol('INVENTORY_CATALOG');
const INVENTORY_TRANSFER_BOOK = Symbol('INVENTORY_TRANSFER_BOOK');
const INVENTORY_ADMINISTRATION_BOOK = Symbol('INVENTORY_ADMINISTRATION_BOOK');

@Module({
  controllers: [InventoryController],
  providers: [
    PrismaInventoryCatalog,
    PrismaInventoryTransferBook,
    PrismaInventoryAdministrationBook,
    SystemInventoryClock,
    UuidV7InventoryIdGenerator,
    { provide: INVENTORY_CATALOG, useExisting: PrismaInventoryCatalog },
    { provide: INVENTORY_TRANSFER_BOOK, useExisting: PrismaInventoryTransferBook },
    { provide: INVENTORY_ADMINISTRATION_BOOK, useExisting: PrismaInventoryAdministrationBook },
    {
      provide: ListInventoryLocations,
      inject: [INVENTORY_CATALOG],
      useFactory: (catalog: InventoryCatalog): ListInventoryLocations =>
        new ListInventoryLocations(catalog),
    },
    {
      provide: WriteOffInventory,
      inject: [INVENTORY_ADMINISTRATION_BOOK, UuidV7InventoryIdGenerator, SystemInventoryClock],
      useFactory: (
        book: InventoryAdministrationBook,
        ids: UuidV7InventoryIdGenerator,
        clock: SystemInventoryClock,
      ): WriteOffInventory => new WriteOffInventory(book, ids, clock),
    },
    {
      provide: AdjustInventoryCount,
      inject: [INVENTORY_ADMINISTRATION_BOOK, UuidV7InventoryIdGenerator, SystemInventoryClock],
      useFactory: (
        book: InventoryAdministrationBook,
        ids: UuidV7InventoryIdGenerator,
        clock: SystemInventoryClock,
      ): AdjustInventoryCount => new AdjustInventoryCount(book, ids, clock),
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
