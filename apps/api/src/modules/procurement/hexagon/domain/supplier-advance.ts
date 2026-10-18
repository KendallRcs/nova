export type ProcurementPaymentMethod = 'cash' | 'yape' | 'plin' | 'pos';

export class InvalidAdvanceAmountError extends Error {
  constructor() {
    super('El importe del anticipo debe ser un entero positivo.');
    this.name = 'InvalidAdvanceAmountError';
  }
}

export function prepareSupplierAdvance(input: { amountCents: number; purpose?: string | null }): {
  amountCents: number;
  purpose: string | null;
} {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new InvalidAdvanceAmountError();
  }
  const purpose = input.purpose?.trim().replace(/\s+/g, ' ') ?? '';
  return { amountCents: input.amountCents, purpose: purpose.length === 0 ? null : purpose };
}

export interface SupplierAdvanceBalance {
  id: string;
  currentBalanceCents: number;
  status: 'pending' | 'resolved';
  version: number;
  updatedAt: Date;
}

export type ResolveAdvanceResult =
  | { readonly ok: true; readonly balance: SupplierAdvanceBalance }
  | { readonly ok: false; readonly reason: 'invalid-amount' | 'insufficient-balance' };

export class SupplierAdvance {
  private constructor(private balance: SupplierAdvanceBalance) {}

  static restore(balance: SupplierAdvanceBalance): SupplierAdvance {
    return new SupplierAdvance({ ...balance });
  }

  resolve(amountCents: number, now: Date): ResolveAdvanceResult {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    if (amountCents > this.balance.currentBalanceCents) {
      return { ok: false, reason: 'insufficient-balance' };
    }
    const currentBalanceCents = this.balance.currentBalanceCents - amountCents;
    this.balance = {
      ...this.balance,
      currentBalanceCents,
      status: currentBalanceCents === 0 ? 'resolved' : 'pending',
      version: this.balance.version + 1,
      updatedAt: now,
    };
    return { ok: true, balance: { ...this.balance } };
  }
}
