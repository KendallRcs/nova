import { Module } from '@nestjs/common';

import { CloudinaryExpenseReceiptStorage } from './adapters/driven/cloudinary/cloudinary-expense-receipt-storage';
import { PrismaExpenseReceiptBook } from './adapters/driven/prisma/prisma-expense-receipt-book';
import { PrismaFinanceBook } from './adapters/driven/prisma/prisma-finance-book';
import {
  SystemFinanceClock,
  UuidV7FinanceIdGenerator,
} from './adapters/driven/system/system-finance-dependencies';
import { FinanceController } from './adapters/driving/http/finance.controller';
import type { FinanceBook } from './hexagon/application/finance-book';
import {
  AttachExpenseReceipt,
  GetExpenseReceiptAccess,
  RemoveExpenseReceipt,
  type ExpenseReceiptBook,
  type ExpenseReceiptStorage,
} from './hexagon/application/expense-receipts';
import {
  CancelExpense,
  ListExpenses,
  ManageExpenseCategories,
  RegisterExpense,
} from './hexagon/application/manage-finance';

const FINANCE_BOOK = Symbol('FINANCE_BOOK');
const EXPENSE_RECEIPT_BOOK = Symbol('EXPENSE_RECEIPT_BOOK');
const EXPENSE_RECEIPT_STORAGE = Symbol('EXPENSE_RECEIPT_STORAGE');
@Module({
  controllers: [FinanceController],
  providers: [
    PrismaFinanceBook,
    PrismaExpenseReceiptBook,
    CloudinaryExpenseReceiptStorage,
    SystemFinanceClock,
    UuidV7FinanceIdGenerator,
    { provide: FINANCE_BOOK, useExisting: PrismaFinanceBook },
    { provide: EXPENSE_RECEIPT_BOOK, useExisting: PrismaExpenseReceiptBook },
    { provide: EXPENSE_RECEIPT_STORAGE, useExisting: CloudinaryExpenseReceiptStorage },
    {
      provide: ManageExpenseCategories,
      inject: [FINANCE_BOOK, UuidV7FinanceIdGenerator, SystemFinanceClock],
      useFactory: (book: FinanceBook, ids: UuidV7FinanceIdGenerator, clock: SystemFinanceClock) =>
        new ManageExpenseCategories(book, ids, clock),
    },
    {
      provide: RegisterExpense,
      inject: [FINANCE_BOOK, UuidV7FinanceIdGenerator],
      useFactory: (book: FinanceBook, ids: UuidV7FinanceIdGenerator) =>
        new RegisterExpense(book, ids),
    },
    {
      provide: CancelExpense,
      inject: [FINANCE_BOOK, UuidV7FinanceIdGenerator, SystemFinanceClock],
      useFactory: (book: FinanceBook, ids: UuidV7FinanceIdGenerator, clock: SystemFinanceClock) =>
        new CancelExpense(book, ids, clock),
    },
    {
      provide: ListExpenses,
      inject: [FINANCE_BOOK],
      useFactory: (book: FinanceBook) => new ListExpenses(book),
    },
    {
      provide: AttachExpenseReceipt,
      inject: [
        EXPENSE_RECEIPT_BOOK,
        EXPENSE_RECEIPT_STORAGE,
        UuidV7FinanceIdGenerator,
        SystemFinanceClock,
      ],
      useFactory: (
        book: ExpenseReceiptBook,
        storage: ExpenseReceiptStorage,
        ids: UuidV7FinanceIdGenerator,
        clock: SystemFinanceClock,
      ) => new AttachExpenseReceipt(book, storage, ids, clock),
    },
    {
      provide: RemoveExpenseReceipt,
      inject: [EXPENSE_RECEIPT_BOOK, EXPENSE_RECEIPT_STORAGE, SystemFinanceClock],
      useFactory: (
        book: ExpenseReceiptBook,
        storage: ExpenseReceiptStorage,
        clock: SystemFinanceClock,
      ) => new RemoveExpenseReceipt(book, storage, clock),
    },
    {
      provide: GetExpenseReceiptAccess,
      inject: [EXPENSE_RECEIPT_BOOK, EXPENSE_RECEIPT_STORAGE, SystemFinanceClock],
      useFactory: (
        book: ExpenseReceiptBook,
        storage: ExpenseReceiptStorage,
        clock: SystemFinanceClock,
      ) => new GetExpenseReceiptAccess(book, storage, clock),
    },
  ],
})
export class OperationalFinanceModule {}
