import type { ProcurementClock, ProcurementIdGenerator } from './procurement.dependencies';
import type { PurchaseBook, PurchaseResult } from './purchase-book';
import {
  preparePurchase,
  type AdvanceApplicationInput,
  type PurchaseLineInput,
} from '../domain/purchase';
import type { ProcurementPaymentMethod } from '../domain/supplier-advance';

export type ConfirmPurchaseResult =
  | PurchaseResult
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

export class ConfirmPurchase {
  constructor(
    private readonly purchases: PurchaseBook,
    private readonly ids: ProcurementIdGenerator,
    private readonly clock: ProcurementClock,
  ) {}

  execute(command: {
    operationId: string;
    supplierId: string;
    actorId: string;
    lines: readonly PurchaseLineInput[];
    advanceApplications: readonly AdvanceApplicationInput[];
    paymentMethod: ProcurementPaymentMethod | null;
  }): Promise<ConfirmPurchaseResult> {
    const prepared = preparePurchase(command);
    if (!prepared.ok) return Promise.resolve(prepared);
    const terms = prepared.terms;
    return this.purchases.confirm({
      purchaseId: this.ids.generate(),
      cashMovementId: terms.newlyPaidCents > 0 ? this.ids.generate() : null,
      operationId: command.operationId,
      supplierId: command.supplierId,
      actorId: command.actorId,
      lines: terms.lines.map((line) => ({
        ...line,
        lineId: this.ids.generate(),
        inventoryMovementId: this.ids.generate(),
        costMovementId: this.ids.generate(),
      })),
      advanceApplications: terms.advanceApplications.map((application) => ({
        ...application,
        applicationId: this.ids.generate(),
      })),
      totalCents: terms.totalCents,
      advanceAppliedCents: terms.advanceAppliedCents,
      newlyPaidCents: terms.newlyPaidCents,
      paymentMethod: terms.paymentMethod,
      effectiveAt: this.clock.now(),
    });
  }
}
