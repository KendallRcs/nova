import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  CashMovementDirection,
  OperatingExpenseStatus,
  PaymentMethod,
  Prisma,
  RecordStatus,
} from '../../../../../generated/prisma/client';
import type {
  ExpenseCategoryView,
  ExpenseView,
  FinanceBook,
  FinanceResult,
} from '../../../hexagon/application/finance-book';
import {
  prepareExpenseCancellation,
  type FinancePaymentMethod,
} from '../../../hexagon/domain/expense';

@Injectable()
export class PrismaFinanceBook implements FinanceBook {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(input: {
    id: string;
    name: string;
    nameNormalized: string;
    description: string | null;
    now: Date;
  }): Promise<FinanceResult<ExpenseCategoryView>> {
    try {
      const row = await this.prisma.expenseCategory.create({
        data: {
          id: input.id,
          name: input.name,
          nameNormalized: input.nameNormalized,
          description: input.description,
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
      return { ok: true, value: categoryView(row), replayed: false };
    } catch (error) {
      if (isUnique(error)) return { ok: false, reason: 'category-name-conflict' };
      throw error;
    }
  }

  async listCategories(): Promise<ExpenseCategoryView[]> {
    return (
      await this.prisma.expenseCategory.findMany({
        orderBy: [{ nameNormalized: 'asc' }, { id: 'asc' }],
      })
    ).map(categoryView);
  }

  async renameCategory(input: {
    id: string;
    name: string;
    nameNormalized: string;
    description?: string | null;
    now: Date;
  }): Promise<FinanceResult<ExpenseCategoryView>> {
    try {
      const updated = await this.prisma.expenseCategory.updateMany({
        where: { id: input.id },
        data: {
          name: input.name,
          nameNormalized: input.nameNormalized,
          ...(input.description === undefined ? {} : { description: input.description }),
          updatedAt: input.now,
        },
      });
      if (updated.count === 0) return { ok: false, reason: 'category-not-found' };
      const row = await this.prisma.expenseCategory.findUniqueOrThrow({ where: { id: input.id } });
      return { ok: true, value: categoryView(row), replayed: false };
    } catch (error) {
      if (isUnique(error)) return { ok: false, reason: 'category-name-conflict' };
      throw error;
    }
  }

  async deactivateCategory(id: string, now: Date): Promise<FinanceResult<ExpenseCategoryView>> {
    const updated = await this.prisma.expenseCategory.updateMany({
      where: { id },
      data: { status: RecordStatus.INACTIVE, updatedAt: now },
    });
    if (updated.count === 0) return { ok: false, reason: 'category-not-found' };
    const row = await this.prisma.expenseCategory.findUniqueOrThrow({ where: { id } });
    return { ok: true, value: categoryView(row), replayed: false };
  }

  async registerExpense(
    input: Parameters<FinanceBook['registerExpense']>[0],
  ): Promise<FinanceResult<ExpenseView>> {
    const fingerprint = JSON.stringify({
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      method: input.method,
      description: input.description,
      receiptStorageKey: input.receiptStorageKey,
      actorId: input.actorId,
      effectiveAt: input.effectiveAt.toISOString(),
    });
    const existing = await this.prisma.operatingExpense.findUnique({
      where: { operationId: input.operationId },
      include: expenseInclude,
    });
    if (existing !== null) return replayExpense(existing, input.operationId, fingerprint);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const repeated = await tx.operatingExpense.findUnique({
          where: { operationId: input.operationId },
          include: expenseInclude,
        });
        if (repeated !== null) return replayExpense(repeated, input.operationId, fingerprint);
        const category = await tx.expenseCategory.findFirst({ where: { id: input.categoryId } });
        if (category === null) return { ok: false, reason: 'category-not-found' } as const;
        if (category.status !== RecordStatus.ACTIVE)
          return { ok: false, reason: 'category-inactive' } as const;
        const row = await tx.operatingExpense.create({
          data: {
            id: input.id,
            operationId: input.operationId,
            requestFingerprint: fingerprint,
            categoryId: input.categoryId,
            amountCents: BigInt(input.amountCents),
            method: toMethod(input.method),
            description: input.description,
            receiptStorageKey: input.receiptStorageKey,
            registeredBy: input.actorId,
            effectiveAt: input.effectiveAt,
            createdAt: input.effectiveAt,
            updatedAt: input.effectiveAt,
            cashMovement: {
              create: {
                id: input.cashMovementId,
                idempotencyKey: input.operationId,
                direction: CashMovementDirection.OUTFLOW,
                amountCents: BigInt(input.amountCents),
                method: toMethod(input.method),
                registeredBy: input.actorId,
                effectiveAt: input.effectiveAt,
                reason: `Gasto operativo ${input.id}`,
              },
            },
          },
          include: expenseInclude,
        });
        return { ok: true, value: expenseView(row), replayed: false } as const;
      });
    } catch (error) {
      if (isUnique(error)) {
        const repeated = await this.prisma.operatingExpense.findUnique({
          where: { operationId: input.operationId },
          include: expenseInclude,
        });
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replayExpense(repeated, input.operationId, fingerprint);
      }
      throw error;
    }
  }

  async cancelExpense(
    input: Parameters<FinanceBook['cancelExpense']>[0],
  ): Promise<FinanceResult<ExpenseView>> {
    const fingerprint = JSON.stringify({
      expenseId: input.expenseId,
      reason: input.reason.trim(),
      refundReceived: input.refundReceived,
      refundMethod: input.refundMethod,
      actorId: input.actorId,
    });
    const existing = await this.prisma.expenseCancellation.findUnique({
      where: { operationId: input.operationId },
      include: { expense: { include: expenseInclude } },
    });
    if (existing !== null)
      return existing.requestFingerprint === fingerprint && existing.expenseId === input.expenseId
        ? { ok: true, value: expenseView(existing.expense), replayed: true }
        : { ok: false, reason: 'idempotency-conflict' };
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "operating_expenses" WHERE "id" = ${input.expenseId}::uuid FOR UPDATE`,
          );
          const expense = await tx.operatingExpense.findUnique({
            where: { id: input.expenseId },
            include: expenseInclude,
          });
          if (expense === null) return { ok: false, reason: 'expense-not-found' } as const;
          if (expense.status === OperatingExpenseStatus.CANCELLED)
            return { ok: false, reason: 'expense-already-cancelled' } as const;
          const prepared = prepareExpenseCancellation({
            expenseAmountCents: safeNumber(expense.amountCents),
            reason: input.reason,
            refundReceived: input.refundReceived,
            refundMethod: input.refundMethod,
          });
          if (!prepared.ok) return prepared;
          await tx.expenseCancellation.create({
            data: {
              id: input.id,
              expenseId: input.expenseId,
              operationId: input.operationId,
              requestFingerprint: fingerprint,
              reason: prepared.reason,
              refundAmountCents: BigInt(prepared.refundAmountCents),
              refundMethod: prepared.refundMethod === null ? null : toMethod(prepared.refundMethod),
              cancelledBy: input.actorId,
              effectiveAt: input.effectiveAt,
              createdAt: input.effectiveAt,
              ...(prepared.refundAmountCents === 0 ||
              prepared.refundMethod === null ||
              input.cashMovementId === null
                ? {}
                : {
                    cashMovement: {
                      create: {
                        id: input.cashMovementId,
                        idempotencyKey: input.operationId,
                        direction: CashMovementDirection.INFLOW,
                        amountCents: BigInt(prepared.refundAmountCents),
                        method: toMethod(prepared.refundMethod),
                        registeredBy: input.actorId,
                        effectiveAt: input.effectiveAt,
                        reason: `Devolución total de gasto ${input.expenseId}`,
                      },
                    },
                  }),
            },
          });
          const row = await tx.operatingExpense.update({
            where: { id: input.expenseId },
            data: { status: OperatingExpenseStatus.CANCELLED, updatedAt: input.effectiveAt },
            include: expenseInclude,
          });
          return { ok: true, value: expenseView(row), replayed: false } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        isUnique(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      )
        return { ok: false, reason: 'concurrency-conflict' };
      throw error;
    }
  }

  async listExpenses(): Promise<ExpenseView[]> {
    return (
      await this.prisma.operatingExpense.findMany({
        include: expenseInclude,
        orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
      })
    ).map(expenseView);
  }
}

const expenseInclude = { category: true, cancellation: true } as const;
type ExpenseRow = Prisma.OperatingExpenseGetPayload<{ include: typeof expenseInclude }>;
function categoryView(row: {
  id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}): ExpenseCategoryView {
  return { ...row, status: row.status === RecordStatus.ACTIVE ? 'active' : 'inactive' };
}
function expenseView(row: ExpenseRow): ExpenseView {
  return {
    id: row.id,
    operationId: row.operationId,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    amountCents: safeNumber(row.amountCents),
    method: fromMethod(row.method),
    description: row.description,
    receiptStorageKey: row.receiptStorageKey,
    status: row.status === OperatingExpenseStatus.CONFIRMED ? 'confirmed' : 'cancelled',
    registeredBy: row.registeredBy,
    effectiveAt: row.effectiveAt,
    cancellation:
      row.cancellation === null
        ? null
        : {
            reason: row.cancellation.reason,
            refundAmountCents: safeNumber(row.cancellation.refundAmountCents),
            refundMethod:
              row.cancellation.refundMethod === null
                ? null
                : fromMethod(row.cancellation.refundMethod),
            cancelledBy: row.cancellation.cancelledBy,
            effectiveAt: row.cancellation.effectiveAt,
          },
  };
}
function replayExpense(
  row: ExpenseRow,
  operationId: string,
  fingerprint: string,
): FinanceResult<ExpenseView> {
  return row.operationId === operationId && row.requestFingerprint === fingerprint
    ? { ok: true, value: expenseView(row), replayed: true }
    : { ok: false, reason: 'idempotency-conflict' };
}
function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Amount exceeds JSON safe integer range.');
  return number;
}
function toMethod(method: FinancePaymentMethod): PaymentMethod {
  return method === 'cash'
    ? PaymentMethod.CASH
    : method === 'yape'
      ? PaymentMethod.YAPE
      : method === 'plin'
        ? PaymentMethod.PLIN
        : PaymentMethod.POS;
}
function fromMethod(method: PaymentMethod): FinancePaymentMethod {
  return method === PaymentMethod.CASH
    ? 'cash'
    : method === PaymentMethod.YAPE
      ? 'yape'
      : method === PaymentMethod.PLIN
        ? 'plin'
        : 'pos';
}
