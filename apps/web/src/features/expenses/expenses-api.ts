import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { newOperationId } from '@/shared/api/idempotency';
import { toApiProblem } from '@/shared/api/problem-details';

type CategorySchema = components['schemas']['ExpenseCategoryResponse'];
type ExpenseSchema = components['schemas']['ExpenseResponse'];

export type ExpenseCategory = Omit<CategorySchema, 'description'> & { description: string | null };
export type Expense = Omit<ExpenseSchema, 'description'> & { description: string | null };
export type PaymentMethod = Expense['method'];

export const expenseCategoriesQueryKey = ['expense-categories'] as const;
export const expensesQueryKey = ['operating-expenses'] as const;

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/expense-categories');
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items as ExpenseCategory[];
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategory> {
  const { data, error, response } = await apiClient.POST('/api/v1/expense-categories', {
    body: { name, description: null } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as ExpenseCategory;
}

export async function renameExpenseCategory(
  categoryId: string,
  name: string,
): Promise<ExpenseCategory> {
  const { data, error, response } = await apiClient.PATCH(
    '/api/v1/expense-categories/{categoryId}',
    {
      params: { path: { categoryId } },
      body: { name, description: null } as never,
    },
  );
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as ExpenseCategory;
}

export async function deactivateExpenseCategory(categoryId: string): Promise<ExpenseCategory> {
  const { data, error, response } = await apiClient.POST(
    '/api/v1/expense-categories/{categoryId}/deactivation',
    { params: { path: { categoryId } } },
  );
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as ExpenseCategory;
}

export async function listExpenses(): Promise<Expense[]> {
  const { data, error, response } = await apiClient.GET('/api/v1/operating-expenses');
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.items as Expense[];
}

export async function registerExpense(input: {
  operationId: string;
  categoryId: string;
  amountCents: number;
  method: PaymentMethod;
  description: string | null;
  effectiveAt: string;
}): Promise<Expense> {
  const { data, error, response } = await apiClient.POST('/api/v1/operating-expenses', {
    headers: { 'Idempotency-Key': input.operationId },
    body: {
      categoryId: input.categoryId,
      amountCents: input.amountCents,
      method: input.method,
      description: input.description,
      effectiveAt: input.effectiveAt,
    } as never,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as Expense;
}

export async function cancelExpense(input: {
  operationId: string;
  expenseId: string;
  reason: string;
  refundReceived: boolean;
  refundMethod: PaymentMethod | null;
}): Promise<Expense> {
  const { data, error, response } = await apiClient.POST(
    '/api/v1/operating-expenses/{expenseId}/cancellations',
    {
      params: { path: { expenseId: input.expenseId } },
      headers: { 'Idempotency-Key': input.operationId },
      body: {
        reason: input.reason,
        refundReceived: input.refundReceived,
        refundMethod: input.refundMethod,
      },
    },
  );
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data as Expense;
}

export async function attachExpenseReceipt(expenseId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  const { error, response } = await apiClient.PUT(
    '/api/v1/operating-expenses/{expenseId}/receipt',
    {
      params: { path: { expenseId } },
      body: { file: '' },
      bodySerializer: () => form,
    },
  );
  if (!response.ok) throw toApiProblem(response, error);
}

export async function removeExpenseReceipt(expenseId: string): Promise<void> {
  const { error, response } = await apiClient.DELETE(
    '/api/v1/operating-expenses/{expenseId}/receipt',
    { params: { path: { expenseId } } },
  );
  if (!response.ok) throw toApiProblem(response, error);
}

export async function getExpenseReceiptUrl(expenseId: string): Promise<string> {
  const { data, error, response } = await apiClient.GET(
    '/api/v1/operating-expenses/{expenseId}/receipt-access',
    { params: { path: { expenseId } } },
  );
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.url;
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  pos: 'POS',
};

export { newOperationId };
