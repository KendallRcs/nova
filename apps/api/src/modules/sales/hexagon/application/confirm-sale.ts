import type { SaleClock } from './sale.dependencies';
import type { SaleConfirmationBook, SaleConfirmationResult } from './sale-confirmation-book';
import type { PaymentMethod } from '../domain/sale';

export interface ConfirmSaleCommand {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  canConfirmAny: boolean;
  canApprovePriceException: boolean;
  priceExceptions: readonly { saleLineId: string; reason: string }[];
  initialPayment: { amountCents: number; method: PaymentMethod } | null;
}

export class ConfirmSale {
  constructor(
    private readonly confirmations: SaleConfirmationBook,
    private readonly clock: SaleClock,
  ) {}

  execute(command: ConfirmSaleCommand): Promise<SaleConfirmationResult> {
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    const seen = new Set<string>();
    for (const exception of command.priceExceptions) {
      if (seen.has(exception.saleLineId) || exception.reason.trim().length === 0) {
        return Promise.resolve({ ok: false, reason: 'price-exception-reason-required' });
      }
      seen.add(exception.saleLineId);
    }
    if (
      command.initialPayment !== null &&
      (!Number.isSafeInteger(command.initialPayment.amountCents) ||
        command.initialPayment.amountCents <= 0)
    ) {
      return Promise.resolve({ ok: false, reason: 'invalid-payment' });
    }
    return this.confirmations.confirm({ ...command, effectiveAt: this.clock.now() });
  }
}
