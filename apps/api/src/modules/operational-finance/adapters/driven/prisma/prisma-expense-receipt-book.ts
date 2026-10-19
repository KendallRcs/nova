import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';
import type {
  ExpenseReceiptBook,
  RemoveExpenseReceiptBookResult,
  ReplaceExpenseReceiptBookResult,
} from '../../../hexagon/application/expense-receipts';

@Injectable()
export class PrismaExpenseReceiptBook implements ExpenseReceiptBook {
  constructor(private readonly prisma: PrismaService) {}

  async expenseExists(expenseId: string): Promise<boolean> {
    return (await this.prisma.operatingExpense.count({ where: { id: expenseId } })) === 1;
  }

  replace(
    input: Parameters<ExpenseReceiptBook['replace']>[0],
  ): Promise<ReplaceExpenseReceiptBookResult> {
    return this.prisma.$transaction(async (tx) => {
      await lockExpense(tx, input.expenseId);
      const expense = await tx.operatingExpense.findUnique({
        where: { id: input.expenseId },
        select: { receiptStorageKey: true },
      });
      if (expense === null) return { ok: false, reason: 'expense-not-found' };
      await tx.operatingExpense.update({
        where: { id: input.expenseId },
        data: { receiptStorageKey: input.storageKey, updatedAt: input.now },
      });
      return { ok: true, previousStorageKey: expense.receiptStorageKey };
    });
  }

  remove(
    input: Parameters<ExpenseReceiptBook['remove']>[0],
  ): Promise<RemoveExpenseReceiptBookResult> {
    return this.prisma.$transaction(async (tx) => {
      await lockExpense(tx, input.expenseId);
      const expense = await tx.operatingExpense.findUnique({
        where: { id: input.expenseId },
        select: { receiptStorageKey: true },
      });
      if (expense === null) return { ok: false, reason: 'expense-not-found' };
      if (expense.receiptStorageKey === null) return { ok: false, reason: 'receipt-not-found' };
      await tx.operatingExpense.update({
        where: { id: input.expenseId },
        data: { receiptStorageKey: null, updatedAt: input.now },
      });
      return { ok: true, removedStorageKey: expense.receiptStorageKey };
    });
  }

  async findStorageKey(expenseId: string) {
    const expense = await this.prisma.operatingExpense.findUnique({
      where: { id: expenseId },
      select: { receiptStorageKey: true },
    });
    if (expense === null) return { ok: false, reason: 'expense-not-found' } as const;
    if (expense.receiptStorageKey === null) {
      return { ok: false, reason: 'receipt-not-found' } as const;
    }
    return { ok: true, storageKey: expense.receiptStorageKey } as const;
  }
}

async function lockExpense(tx: Prisma.TransactionClient, expenseId: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "operating_expenses" WHERE "id" = ${expenseId}::uuid FOR UPDATE`,
  );
}
