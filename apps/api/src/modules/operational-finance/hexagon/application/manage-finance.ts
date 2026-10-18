import type { FinanceBook, FinanceResult, ExpenseCategoryView, ExpenseView } from './finance-book';
import type { FinanceClock, FinanceIdGenerator } from './finance.dependencies';
import {
  normalizeExpenseCategoryName,
  optionalText,
  prepareExpense,
  type FinancePaymentMethod,
} from '../domain/expense';

export class ManageExpenseCategories {
  constructor(
    private readonly book: FinanceBook,
    private readonly ids: FinanceIdGenerator,
    private readonly clock: FinanceClock,
  ) {}
  create(input: {
    name: string;
    description?: string | null;
  }): Promise<FinanceResult<ExpenseCategoryView>> {
    const name = normalizeExpenseCategoryName(input.name);
    return this.book.createCategory({
      id: this.ids.generate(),
      ...name,
      description: optionalText(input.description),
      now: this.clock.now(),
    });
  }
  list(): Promise<ExpenseCategoryView[]> {
    return this.book.listCategories();
  }
  rename(
    id: string,
    input: { name: string; description?: string | null },
  ): Promise<FinanceResult<ExpenseCategoryView>> {
    const name = normalizeExpenseCategoryName(input.name);
    return this.book.renameCategory({
      id,
      ...name,
      ...(input.description === undefined ? {} : { description: optionalText(input.description) }),
      now: this.clock.now(),
    });
  }
  deactivate(id: string): Promise<FinanceResult<ExpenseCategoryView>> {
    return this.book.deactivateCategory(id, this.clock.now());
  }
}

export class RegisterExpense {
  constructor(
    private readonly book: FinanceBook,
    private readonly ids: FinanceIdGenerator,
  ) {}
  execute(input: {
    operationId: string;
    categoryId: string;
    amountCents: number;
    method: FinancePaymentMethod;
    description?: string | null;
    receiptStorageKey?: string | null;
    actorId: string;
    effectiveAt: Date;
  }): Promise<FinanceResult<ExpenseView> | { ok: false; reason: 'invalid-amount' }> {
    const prepared = prepareExpense(input);
    if (!prepared.ok) return Promise.resolve(prepared);
    return this.book.registerExpense({
      id: this.ids.generate(),
      cashMovementId: this.ids.generate(),
      operationId: input.operationId,
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      method: input.method,
      ...prepared,
      actorId: input.actorId,
      effectiveAt: input.effectiveAt,
    });
  }
}

export class CancelExpense {
  constructor(
    private readonly book: FinanceBook,
    private readonly ids: FinanceIdGenerator,
    private readonly clock: FinanceClock,
  ) {}
  execute(input: {
    operationId: string;
    expenseId: string;
    reason: string;
    refundReceived: boolean;
    refundMethod?: FinancePaymentMethod | null;
    actorId: string;
  }): Promise<FinanceResult<ExpenseView>> {
    return this.book.cancelExpense({
      id: this.ids.generate(),
      cashMovementId: input.refundReceived ? this.ids.generate() : null,
      operationId: input.operationId,
      expenseId: input.expenseId,
      reason: input.reason,
      refundReceived: input.refundReceived,
      refundMethod: input.refundMethod ?? null,
      actorId: input.actorId,
      effectiveAt: this.clock.now(),
    });
  }
}

export class ListExpenses {
  constructor(private readonly book: FinanceBook) {}
  execute(): Promise<ExpenseView[]> {
    return this.book.listExpenses();
  }
}
