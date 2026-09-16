import type { SaleClock } from './sale.dependencies';
import type { SalePaymentBook, SalePaymentResult } from './sale-payment-book';
import type { PaymentMethod } from '../domain/sale';

export interface RecordSalePaymentCommand {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
  canRegisterAny: boolean;
  amountCents: number;
  method: PaymentMethod;
}

export class RecordSalePayment {
  constructor(
    private readonly payments: SalePaymentBook,
    private readonly clock: SaleClock,
  ) {}

  execute(command: RecordSalePaymentCommand): Promise<SalePaymentResult> {
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    if (!Number.isSafeInteger(command.amountCents) || command.amountCents <= 0) {
      return Promise.resolve({ ok: false, reason: 'invalid-payment' });
    }
    return this.payments.record({ ...command, effectiveAt: this.clock.now() });
  }
}
