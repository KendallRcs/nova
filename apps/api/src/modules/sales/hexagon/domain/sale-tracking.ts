import type { SaleLifecycle } from './sale';

export type TrackedPaymentSituation =
  'not-applicable' | 'unpaid' | 'partial' | 'paid' | 'closed-with-balance';
export type DeliverySituation = 'not-applicable' | 'pending' | 'partial' | 'complete';

export interface SaleTracking {
  paidCents: number;
  balanceCents: number;
  paymentSituation: TrackedPaymentSituation;
  deliverySituation: DeliverySituation;
  overdue: boolean;
}

export function deriveSaleTracking(input: {
  lifecycle: SaleLifecycle;
  currentTotalCents: number;
  paymentAmountsCents: readonly number[];
  forgivenAmountCents: number;
  lineQuantities: readonly { quantity: number; deliveredQuantity: number }[];
  dueDate: string | null;
  todayInLima: string;
}): SaleTracking {
  const paidCents = safeSum(input.paymentAmountsCents);
  const forgivenAmountCents = safeSum([input.forgivenAmountCents]);
  const balanceCents = Math.max(0, input.currentTotalCents - paidCents - forgivenAmountCents);
  const active = input.lifecycle === 'confirmed' || input.lifecycle === 'finalized';
  const paymentSituation: TrackedPaymentSituation = !active
    ? 'not-applicable'
    : input.lifecycle === 'finalized' && forgivenAmountCents > 0
      ? 'closed-with-balance'
      : balanceCents === 0
        ? 'paid'
        : paidCents === 0
          ? 'unpaid'
          : 'partial';
  const totalQuantity = safeSum(input.lineQuantities.map(({ quantity }) => quantity));
  const deliveredQuantity = safeSum(
    input.lineQuantities.map(({ deliveredQuantity: quantity }) => quantity),
  );
  const deliverySituation: DeliverySituation = !active
    ? 'not-applicable'
    : totalQuantity > 0 && deliveredQuantity >= totalQuantity
      ? 'complete'
      : deliveredQuantity === 0
        ? 'pending'
        : 'partial';
  return {
    paidCents,
    balanceCents,
    paymentSituation,
    deliverySituation,
    overdue:
      input.lifecycle === 'confirmed' &&
      balanceCents > 0 &&
      input.dueDate !== null &&
      input.dueDate < input.todayInLima,
  };
}

function safeSum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid sale tracking value.');
    total += value;
    if (!Number.isSafeInteger(total)) throw new Error('Sale tracking total exceeds safe range.');
  }
  return total;
}
