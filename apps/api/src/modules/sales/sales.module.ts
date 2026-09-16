import { Module } from '@nestjs/common';

import { PrismaSaleDraftReferences } from './adapters/driven/prisma/prisma-sale-draft-references';
import { PrismaSaleDraftRepository } from './adapters/driven/prisma/prisma-sale-draft.repository';
import { PrismaSaleConfirmationBook } from './adapters/driven/prisma/prisma-sale-confirmation-book';
import {
  SystemSaleClock,
  UuidV7SaleIdGenerator,
} from './adapters/driven/system/system-sale-dependencies';
import { SalesController } from './adapters/driving/http/sales.controller';
import { CreateSaleDraft, UpdateSaleDraft } from './hexagon/application/manage-sale-drafts';
import { ConfirmSale } from './hexagon/application/confirm-sale';
import type { SaleConfirmationBook } from './hexagon/application/sale-confirmation-book';
import type {
  SaleDraftReferences,
  SaleDraftRepository,
} from './hexagon/application/sale-draft.repository';

const SALE_DRAFT_REPOSITORY = Symbol('SALE_DRAFT_REPOSITORY');
const SALE_DRAFT_REFERENCES = Symbol('SALE_DRAFT_REFERENCES');
const SALE_CONFIRMATION_BOOK = Symbol('SALE_CONFIRMATION_BOOK');

@Module({
  controllers: [SalesController],
  providers: [
    PrismaSaleDraftRepository,
    PrismaSaleDraftReferences,
    PrismaSaleConfirmationBook,
    SystemSaleClock,
    UuidV7SaleIdGenerator,
    { provide: SALE_DRAFT_REPOSITORY, useExisting: PrismaSaleDraftRepository },
    { provide: SALE_DRAFT_REFERENCES, useExisting: PrismaSaleDraftReferences },
    { provide: SALE_CONFIRMATION_BOOK, useExisting: PrismaSaleConfirmationBook },
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
    {
      provide: ConfirmSale,
      inject: [SALE_CONFIRMATION_BOOK, SystemSaleClock],
      useFactory: (confirmations: SaleConfirmationBook, clock: SystemSaleClock) =>
        new ConfirmSale(confirmations, clock),
    },
  ],
})
export class SalesModule {}
