import { Module } from '@nestjs/common';

import { PrismaFinanceBook } from './adapters/driven/prisma/prisma-finance-book';
import {
  SystemFinanceClock,
  UuidV7FinanceIdGenerator,
} from './adapters/driven/system/system-finance-dependencies';
import { FinanceController } from './adapters/driving/http/finance.controller';
import type { FinanceBook } from './hexagon/application/finance-book';
import {
  CancelExpense,
  ListExpenses,
  ManageExpenseCategories,
  RegisterExpense,
} from './hexagon/application/manage-finance';

const FINANCE_BOOK = Symbol('FINANCE_BOOK');
@Module({
  controllers: [FinanceController],
  providers: [
    PrismaFinanceBook,
    SystemFinanceClock,
    UuidV7FinanceIdGenerator,
    { provide: FINANCE_BOOK, useExisting: PrismaFinanceBook },
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
  ],
})
export class OperationalFinanceModule {}
