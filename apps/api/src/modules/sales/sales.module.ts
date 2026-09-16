import { Module } from '@nestjs/common';

import { PrismaSaleDraftReferences } from './adapters/driven/prisma/prisma-sale-draft-references';
import { PrismaSaleDraftRepository } from './adapters/driven/prisma/prisma-sale-draft.repository';
import {
  SystemSaleClock,
  UuidV7SaleIdGenerator,
} from './adapters/driven/system/system-sale-dependencies';
import { SalesController } from './adapters/driving/http/sales.controller';
import { CreateSaleDraft, UpdateSaleDraft } from './hexagon/application/manage-sale-drafts';
import type {
  SaleDraftReferences,
  SaleDraftRepository,
} from './hexagon/application/sale-draft.repository';

const SALE_DRAFT_REPOSITORY = Symbol('SALE_DRAFT_REPOSITORY');
const SALE_DRAFT_REFERENCES = Symbol('SALE_DRAFT_REFERENCES');

@Module({
  controllers: [SalesController],
  providers: [
    PrismaSaleDraftRepository,
    PrismaSaleDraftReferences,
    SystemSaleClock,
    UuidV7SaleIdGenerator,
    { provide: SALE_DRAFT_REPOSITORY, useExisting: PrismaSaleDraftRepository },
    { provide: SALE_DRAFT_REFERENCES, useExisting: PrismaSaleDraftReferences },
    {
      provide: CreateSaleDraft,
      inject: [
        SALE_DRAFT_REPOSITORY,
        SALE_DRAFT_REFERENCES,
        UuidV7SaleIdGenerator,
        SystemSaleClock,
      ],
      useFactory: (
        repository: SaleDraftRepository,
        references: SaleDraftReferences,
        ids: UuidV7SaleIdGenerator,
        clock: SystemSaleClock,
      ) => new CreateSaleDraft(repository, references, ids, clock),
    },
    {
      provide: UpdateSaleDraft,
      inject: [
        SALE_DRAFT_REPOSITORY,
        SALE_DRAFT_REFERENCES,
        UuidV7SaleIdGenerator,
        SystemSaleClock,
      ],
      useFactory: (
        repository: SaleDraftRepository,
        references: SaleDraftReferences,
        ids: UuidV7SaleIdGenerator,
        clock: SystemSaleClock,
      ) => new UpdateSaleDraft(repository, references, ids, clock),
    },
  ],
})
export class SalesModule {}
