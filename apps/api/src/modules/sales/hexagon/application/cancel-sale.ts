import type { SaleClock } from './sale.dependencies';
import type {
  PreparedSaleCancellation,
  SaleCancellationBook,
  SaleCancellationResult,
} from './sale-cancellation-book';

export type CancelSaleCommand = Omit<PreparedSaleCancellation, 'effectiveAt'>;

export class CancelSale {
  constructor(
    private readonly cancellations: SaleCancellationBook,
    private readonly clock: SaleClock,
  ) {}

  execute(command: CancelSaleCommand): Promise<SaleCancellationResult> {
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    return this.cancellations.cancel({ ...command, effectiveAt: this.clock.now() });
  }
}
