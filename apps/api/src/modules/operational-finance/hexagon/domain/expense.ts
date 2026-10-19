export type FinancePaymentMethod = 'cash' | 'yape' | 'plin' | 'pos';

export class InvalidExpenseCategoryNameError extends Error {
  constructor() {
    super('El nombre de la categoría de gasto es obligatorio.');
    this.name = 'InvalidExpenseCategoryNameError';
  }
}

export function normalizeExpenseCategoryName(value: string): {
  name: string;
  nameNormalized: string;
} {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length === 0) throw new InvalidExpenseCategoryNameError();
  return { name, nameNormalized: name.normalize('NFKC').toLocaleLowerCase('es-PE') };
}

export function optionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export type ExpenseInputResult =
  { ok: true; description: string | null } | { ok: false; reason: 'invalid-amount' };

export function prepareExpense(input: {
  amountCents: number;
  description?: string | null;
}): ExpenseInputResult {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, reason: 'invalid-amount' };
  }
  return {
    ok: true,
    description: optionalText(input.description),
  };
}

export type ExpenseCancellationInputResult =
  | {
      ok: true;
      reason: string;
      refundAmountCents: number;
      refundMethod: FinancePaymentMethod | null;
    }
  | { ok: false; reason: 'invalid-reason' | 'refund-method-required' | 'unexpected-refund-method' };

export function prepareExpenseCancellation(input: {
  expenseAmountCents: number;
  reason: string;
  refundReceived: boolean;
  refundMethod?: FinancePaymentMethod | null;
}): ExpenseCancellationInputResult {
  const reason = optionalText(input.reason);
  if (reason === null) return { ok: false, reason: 'invalid-reason' };
  if (input.refundReceived && input.refundMethod == null) {
    return { ok: false, reason: 'refund-method-required' };
  }
  if (!input.refundReceived && input.refundMethod != null) {
    return { ok: false, reason: 'unexpected-refund-method' };
  }
  return {
    ok: true,
    reason,
    refundAmountCents: input.refundReceived ? input.expenseAmountCents : 0,
    refundMethod: input.refundReceived ? (input.refundMethod ?? null) : null,
  };
}
