import type { ProcurementClock, ProcurementIdGenerator } from './procurement.dependencies';
import type { SupplierAdvanceBook, SupplierAdvanceResult } from './supplier-advance-book';
import { prepareSupplierAdvance, type ProcurementPaymentMethod } from '../domain/supplier-advance';

export class RegisterSupplierAdvance {
  constructor(
    private readonly book: SupplierAdvanceBook,
    private readonly ids: ProcurementIdGenerator,
    private readonly clock: ProcurementClock,
  ) {}

  execute(command: {
    operationId: string;
    supplierId: string;
    amountCents: number;
    method: ProcurementPaymentMethod;
    purpose?: string | null;
    actorId: string;
  }): Promise<SupplierAdvanceResult> {
    const prepared = prepareSupplierAdvance(command);
    return this.book.register({
      ...command,
      ...prepared,
      advanceId: this.ids.generate(),
      cashMovementId: this.ids.generate(),
      effectiveAt: this.clock.now(),
    });
  }
}
