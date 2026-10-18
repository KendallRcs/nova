import type { FinancePaymentMethod } from '../domain/expense';

export interface ExpenseCategoryView {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
export interface ExpenseView {
  id: string;
  operationId: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  method: FinancePaymentMethod;
  description: string | null;
  receiptStorageKey: string | null;
  status: 'confirmed' | 'cancelled';
  registeredBy: string;
  effectiveAt: Date;
  cancellation: null | {
    reason: string;
    refundAmountCents: number;
    refundMethod: FinancePaymentMethod | null;
    cancelledBy: string;
    effectiveAt: Date;
  };
}
export type FinanceResult<T> =
  | { ok: true; value: T; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'category-not-found'
        | 'category-inactive'
        | 'category-name-conflict'
        | 'expense-not-found'
        | 'expense-already-cancelled'
        | 'invalid-reason'
        | 'refund-method-required'
        | 'unexpected-refund-method'
        | 'idempotency-conflict'
        | 'concurrency-conflict';
    };

export interface FinanceBook {
  createCategory(input: {
    id: string;
    name: string;
    nameNormalized: string;
    description: string | null;
    now: Date;
  }): Promise<FinanceResult<ExpenseCategoryView>>;
  listCategories(): Promise<ExpenseCategoryView[]>;
  renameCategory(input: {
    id: string;
    name: string;
    nameNormalized: string;
    description?: string | null;
    now: Date;
  }): Promise<FinanceResult<ExpenseCategoryView>>;
  deactivateCategory(id: string, now: Date): Promise<FinanceResult<ExpenseCategoryView>>;
  registerExpense(input: {
    id: string;
    cashMovementId: string;
    operationId: string;
    categoryId: string;
    amountCents: number;
    method: FinancePaymentMethod;
    description: string | null;
    receiptStorageKey: string | null;
    actorId: string;
    effectiveAt: Date;
  }): Promise<FinanceResult<ExpenseView>>;
  cancelExpense(input: {
    id: string;
    cashMovementId: string | null;
    operationId: string;
    expenseId: string;
    reason: string;
    refundReceived: boolean;
    refundMethod: FinancePaymentMethod | null;
    actorId: string;
    effectiveAt: Date;
  }): Promise<FinanceResult<ExpenseView>>;
  listExpenses(): Promise<ExpenseView[]>;
}
