import { Module } from '@nestjs/common';

import { PrismaSupplierAdvanceBook } from './adapters/driven/prisma/prisma-supplier-advance-book';
import { PrismaSupplierRepository } from './adapters/driven/prisma/prisma-supplier.repository';
import { PrismaSupplierAdvanceResolutionBook } from './adapters/driven/prisma/prisma-supplier-advance-resolution-book';
import { PrismaPurchaseBook } from './adapters/driven/prisma/prisma-purchase-book';
import {
  SystemProcurementClock,
  UuidV7ProcurementIdGenerator,
} from './adapters/driven/system/system-procurement-dependencies';
import { ProcurementController } from './adapters/driving/http/procurement.controller';
import { RegisterSupplier, SearchSuppliers } from './hexagon/application/manage-suppliers';
import { ConfirmPurchase } from './hexagon/application/confirm-purchase';
import type {
  ProcurementClock,
  ProcurementIdGenerator,
} from './hexagon/application/procurement.dependencies';
import { RegisterSupplierAdvance } from './hexagon/application/register-supplier-advance';
import { ResolveSupplierAdvance } from './hexagon/application/resolve-supplier-advance';
import type { SupplierAdvanceBook } from './hexagon/application/supplier-advance-book';
import type { SupplierAdvanceResolutionBook } from './hexagon/application/supplier-advance-resolution-book';
import type { SupplierRepository } from './hexagon/application/supplier.repository';
import type { PurchaseBook } from './hexagon/application/purchase-book';

const SUPPLIERS = Symbol('SUPPLIERS');
const ADVANCES = Symbol('ADVANCES');
const ADVANCE_RESOLUTIONS = Symbol('ADVANCE_RESOLUTIONS');
const PURCHASES = Symbol('PURCHASES');

@Module({
  controllers: [ProcurementController],
  providers: [
    PrismaSupplierRepository,
    PrismaSupplierAdvanceBook,
    PrismaSupplierAdvanceResolutionBook,
    PrismaPurchaseBook,
    SystemProcurementClock,
    UuidV7ProcurementIdGenerator,
    { provide: SUPPLIERS, useExisting: PrismaSupplierRepository },
    { provide: ADVANCES, useExisting: PrismaSupplierAdvanceBook },
    { provide: ADVANCE_RESOLUTIONS, useExisting: PrismaSupplierAdvanceResolutionBook },
    { provide: PURCHASES, useExisting: PrismaPurchaseBook },
    {
      provide: RegisterSupplier,
      inject: [SUPPLIERS, UuidV7ProcurementIdGenerator, SystemProcurementClock],
      useFactory: (
        suppliers: SupplierRepository,
        ids: ProcurementIdGenerator,
        clock: ProcurementClock,
      ) => new RegisterSupplier(suppliers, ids, clock),
    },
    {
      provide: SearchSuppliers,
      inject: [SUPPLIERS],
      useFactory: (suppliers: SupplierRepository) => new SearchSuppliers(suppliers),
    },
    {
      provide: RegisterSupplierAdvance,
      inject: [ADVANCES, UuidV7ProcurementIdGenerator, SystemProcurementClock],
      useFactory: (
        advances: SupplierAdvanceBook,
        ids: ProcurementIdGenerator,
        clock: ProcurementClock,
      ) => new RegisterSupplierAdvance(advances, ids, clock),
    },
    {
      provide: ResolveSupplierAdvance,
      inject: [ADVANCE_RESOLUTIONS, UuidV7ProcurementIdGenerator, SystemProcurementClock],
      useFactory: (
        resolutions: SupplierAdvanceResolutionBook,
        ids: ProcurementIdGenerator,
        clock: ProcurementClock,
      ) => new ResolveSupplierAdvance(resolutions, ids, clock),
    },
    {
      provide: ConfirmPurchase,
      inject: [PURCHASES, UuidV7ProcurementIdGenerator, SystemProcurementClock],
      useFactory: (purchases: PurchaseBook, ids: ProcurementIdGenerator, clock: ProcurementClock) =>
        new ConfirmPurchase(purchases, ids, clock),
    },
  ],
})
export class ProcurementModule {}
