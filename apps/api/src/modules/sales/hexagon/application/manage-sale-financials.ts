import type { SaleClock } from './sale.dependencies';
import type {
  PaymentCorrectionBook,
  PaymentCorrectionResult,
  SaleClosureBook,
  SaleClosureResult,
  SaleTotalAdjustmentBook,
  SaleTotalAdjustmentResult,
} from './sale-financial-book';

interface BaseCommand {
  operationId: string;
  saleId: string;
  expectedVersion: number;
  actorId: string;
}

export class AdjustSaleTotal {
  constructor(
    private readonly book: SaleTotalAdjustmentBook,
    private readonly clock: SaleClock,
  ) {}

  execute(
    command: BaseCommand & { newTotalCents: number; reason: string },
  ): Promise<SaleTotalAdjustmentResult> {
    if (!validVersion(command.expectedVersion)) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    return this.book.adjust({ ...command, effectiveAt: this.clock.now() });
  }
}

export class FinalizeSale {
  constructor(
    private readonly book: SaleClosureBook,
    private readonly clock: SaleClock,
  ) {}

  execute(command: BaseCommand & { reason: string | null }): Promise<SaleClosureResult> {
    if (!validVersion(command.expectedVersion)) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    return this.book.close({ ...command, effectiveAt: this.clock.now() });
  }
}

export class CorrectSalePayment {
  constructor(
    private readonly book: PaymentCorrectionBook,
    private readonly clock: SaleClock,
  ) {}

  execute(
    command: BaseCommand & { paymentId: string; amountCents: number; reason: string },
  ): Promise<PaymentCorrectionResult> {
    if (!validVersion(command.expectedVersion)) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    return this.book.correct({ ...command, effectiveAt: this.clock.now() });
  }
}

function validVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
