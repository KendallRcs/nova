import type { SaleClock } from './sale.dependencies';
import type { PreparedSaleReturn, SaleReturnBook, SaleReturnResult } from './sale-return-book';

export type ApproveSaleReturnCommand = Omit<PreparedSaleReturn, 'effectiveAt'>;

export class ApproveSaleReturn {
  constructor(
    private readonly returns: SaleReturnBook,
    private readonly clock: SaleClock,
  ) {}

  execute(command: ApproveSaleReturnCommand): Promise<SaleReturnResult> {
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    return this.returns.approve({ ...command, effectiveAt: this.clock.now() });
  }
}
