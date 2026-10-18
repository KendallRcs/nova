import type { ProcurementPaymentMethod } from './supplier-advance';

export interface PurchaseLineInput {
  productId: string;
  destinationLocationId: string;
  quantity: number;
  unitCostCents: number;
}

export interface AdvanceApplicationInput {
  advanceId: string;
  expectedVersion: number;
  amountCents: number;
}

export interface PreparedPurchaseTerms {
  lines: readonly (PurchaseLineInput & { subtotalCents: number })[];
  advanceApplications: readonly AdvanceApplicationInput[];
  totalCents: number;
  advanceAppliedCents: number;
  newlyPaidCents: number;
  paymentMethod: ProcurementPaymentMethod | null;
}

export type PreparePurchaseResult =
  | { readonly ok: true; readonly terms: PreparedPurchaseTerms }
  | {
      readonly ok: false;
      readonly reason:
        | 'empty-purchase'
        | 'invalid-line'
        | 'duplicate-line'
        | 'inconsistent-product-cost'
        | 'invalid-advance-application'
        | 'duplicate-advance'
        | 'advance-applications-exceed-total'
        | 'payment-method-required'
        | 'unexpected-payment-method';
    };

export function preparePurchase(input: {
  lines: readonly PurchaseLineInput[];
  advanceApplications: readonly AdvanceApplicationInput[];
  paymentMethod: ProcurementPaymentMethod | null;
}): PreparePurchaseResult {
  if (input.lines.length === 0) return { ok: false, reason: 'empty-purchase' };
  const lineKeys = new Set<string>();
  const productCosts = new Map<string, number>();
  let totalCents = 0;
  const lines: (PurchaseLineInput & { subtotalCents: number })[] = [];
  for (const line of input.lines) {
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isSafeInteger(line.unitCostCents) ||
      line.unitCostCents <= 0
    ) {
      return { ok: false, reason: 'invalid-line' };
    }
    const key = `${line.productId}:${line.destinationLocationId}`;
    if (lineKeys.has(key)) return { ok: false, reason: 'duplicate-line' };
    lineKeys.add(key);
    const productCost = productCosts.get(line.productId);
    if (productCost !== undefined && productCost !== line.unitCostCents) {
      return { ok: false, reason: 'inconsistent-product-cost' };
    }
    productCosts.set(line.productId, line.unitCostCents);
    const subtotalCents = safeMoney(BigInt(line.quantity) * BigInt(line.unitCostCents));
    totalCents = safeMoney(BigInt(totalCents) + BigInt(subtotalCents));
    lines.push({ ...line, subtotalCents });
  }
  const advanceIds = new Set<string>();
  let advanceAppliedCents = 0;
  for (const application of input.advanceApplications) {
    if (
      !Number.isSafeInteger(application.expectedVersion) ||
      application.expectedVersion <= 0 ||
      !Number.isSafeInteger(application.amountCents) ||
      application.amountCents <= 0
    ) {
      return { ok: false, reason: 'invalid-advance-application' };
    }
    if (advanceIds.has(application.advanceId)) return { ok: false, reason: 'duplicate-advance' };
    advanceIds.add(application.advanceId);
    advanceAppliedCents = safeMoney(BigInt(advanceAppliedCents) + BigInt(application.amountCents));
  }
  if (advanceAppliedCents > totalCents) {
    return { ok: false, reason: 'advance-applications-exceed-total' };
  }
  const newlyPaidCents = totalCents - advanceAppliedCents;
  if (newlyPaidCents > 0 && input.paymentMethod === null) {
    return { ok: false, reason: 'payment-method-required' };
  }
  if (newlyPaidCents === 0 && input.paymentMethod !== null) {
    return { ok: false, reason: 'unexpected-payment-method' };
  }
  return {
    ok: true,
    terms: {
      lines,
      advanceApplications: [...input.advanceApplications],
      totalCents,
      advanceAppliedCents,
      newlyPaidCents,
      paymentMethod: input.paymentMethod,
    },
  };
}

function safeMoney(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Purchase amount exceeds safe integer range.');
  return result;
}
