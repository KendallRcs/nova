import { Module } from '@nestjs/common';

import { PrismaSaleDraftReferences } from './adapters/driven/prisma/prisma-sale-draft-references';
import { PrismaSaleDraftRepository } from './adapters/driven/prisma/prisma-sale-draft.repository';
import { PrismaSaleConfirmationBook } from './adapters/driven/prisma/prisma-sale-confirmation-book';
import { PrismaSalePaymentBook } from './adapters/driven/prisma/prisma-sale-payment-book';
import { PrismaSaleActivitySource } from './adapters/driven/prisma/prisma-sale-activity-source';
import { PrismaSaleFinancialBook } from './adapters/driven/prisma/prisma-sale-financial-book';
import {
  SystemSaleClock,
  UuidV7SaleIdGenerator,
} from './adapters/driven/system/system-sale-dependencies';
import { SalesController } from './adapters/driving/http/sales.controller';
import { CreateSaleDraft, UpdateSaleDraft } from './hexagon/application/manage-sale-drafts';
import { ConfirmSale } from './hexagon/application/confirm-sale';
import { RecordSalePayment } from './hexagon/application/record-sale-payment';
import type { SaleConfirmationBook } from './hexagon/application/sale-confirmation-book';
import type { SalePaymentBook } from './hexagon/application/sale-payment-book';
import { ListSales, type SaleActivitySource } from './hexagon/application/sale-activity';
import { GetSaleDetail, type SaleDetailSource } from './hexagon/application/sale-detail';
import {
  AdjustSaleTotal,
  CorrectSalePayment,
  FinalizeSale,
} from './hexagon/application/manage-sale-financials';
import type {
  PaymentCorrectionBook,
  SaleClosureBook,
  SaleTotalAdjustmentBook,
} from './hexagon/application/sale-financial-book';
import type {
  SaleDraftReferences,
  SaleDraftRepository,
} from './hexagon/application/sale-draft.repository';

const SALE_DRAFT_REPOSITORY = Symbol('SALE_DRAFT_REPOSITORY');
const SALE_DRAFT_REFERENCES = Symbol('SALE_DRAFT_REFERENCES');
const SALE_CONFIRMATION_BOOK = Symbol('SALE_CONFIRMATION_BOOK');
const SALE_PAYMENT_BOOK = Symbol('SALE_PAYMENT_BOOK');
const SALE_ACTIVITY_SOURCE = Symbol('SALE_ACTIVITY_SOURCE');
const SALE_DETAIL_SOURCE = Symbol('SALE_DETAIL_SOURCE');
const SALE_TOTAL_ADJUSTMENT_BOOK = Symbol('SALE_TOTAL_ADJUSTMENT_BOOK');
const SALE_CLOSURE_BOOK = Symbol('SALE_CLOSURE_BOOK');
const PAYMENT_CORRECTION_BOOK = Symbol('PAYMENT_CORRECTION_BOOK');

@Module({
  controllers: [SalesController],
  providers: [
    PrismaSaleDraftRepository,
    PrismaSaleDraftReferences,
    PrismaSaleConfirmationBook,
    PrismaSalePaymentBook,
    PrismaSaleActivitySource,
    PrismaSaleFinancialBook,
    SystemSaleClock,
    UuidV7SaleIdGenerator,
    { provide: SALE_DRAFT_REPOSITORY, useExisting: PrismaSaleDraftRepository },
    { provide: SALE_DRAFT_REFERENCES, useExisting: PrismaSaleDraftReferences },
    { provide: SALE_CONFIRMATION_BOOK, useExisting: PrismaSaleConfirmationBook },
    { provide: SALE_PAYMENT_BOOK, useExisting: PrismaSalePaymentBook },
    { provide: SALE_ACTIVITY_SOURCE, useExisting: PrismaSaleActivitySource },
    { provide: SALE_DETAIL_SOURCE, useExisting: PrismaSaleActivitySource },
    { provide: SALE_TOTAL_ADJUSTMENT_BOOK, useExisting: PrismaSaleFinancialBook },
    { provide: SALE_CLOSURE_BOOK, useExisting: PrismaSaleFinancialBook },
    { provide: PAYMENT_CORRECTION_BOOK, useExisting: PrismaSaleFinancialBook },
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
    {
      provide: RecordSalePayment,
      inject: [SALE_PAYMENT_BOOK, SystemSaleClock],
      useFactory: (payments: SalePaymentBook, clock: SystemSaleClock) =>
        new RecordSalePayment(payments, clock),
    },
    {
      provide: ListSales,
      inject: [SALE_ACTIVITY_SOURCE, SystemSaleClock],
      useFactory: (source: SaleActivitySource, clock: SystemSaleClock) =>
        new ListSales(source, clock),
    },
    {
      provide: GetSaleDetail,
      inject: [SALE_DETAIL_SOURCE, SystemSaleClock],
      useFactory: (source: SaleDetailSource, clock: SystemSaleClock) =>
        new GetSaleDetail(source, clock),
    },
    {
      provide: AdjustSaleTotal,
      inject: [SALE_TOTAL_ADJUSTMENT_BOOK, SystemSaleClock],
      useFactory: (book: SaleTotalAdjustmentBook, clock: SystemSaleClock) =>
        new AdjustSaleTotal(book, clock),
    },
    {
      provide: FinalizeSale,
      inject: [SALE_CLOSURE_BOOK, SystemSaleClock],
      useFactory: (book: SaleClosureBook, clock: SystemSaleClock) => new FinalizeSale(book, clock),
    },
    {
      provide: CorrectSalePayment,
      inject: [PAYMENT_CORRECTION_BOOK, SystemSaleClock],
      useFactory: (book: PaymentCorrectionBook, clock: SystemSaleClock) =>
        new CorrectSalePayment(book, clock),
    },
  ],
})
export class SalesModule {}
