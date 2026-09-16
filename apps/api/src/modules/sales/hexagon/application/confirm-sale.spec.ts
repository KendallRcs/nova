import { describe, expect, it } from 'vitest';

import { ConfirmSale } from './confirm-sale';
import type {
  PreparedSaleConfirmation,
  SaleConfirmationBook,
  SaleConfirmationResult,
} from './sale-confirmation-book';

class RecordingConfirmations implements SaleConfirmationBook {
  command: PreparedSaleConfirmation | undefined;
  confirm(command: PreparedSaleConfirmation): Promise<SaleConfirmationResult> {
    this.command = command;
    return Promise.resolve({ ok: false, reason: 'sale-not-found' });
  }
}

describe('ConfirmSale', () => {
  it('prepares the idempotent confirmation at the application time', async () => {
    const confirmations = new RecordingConfirmations();
    await new ConfirmSale(confirmations, {
      now: () => new Date('2026-09-15T21:00:00.000Z'),
    }).execute({
      operationId: 'operation-1',
      saleId: 'sale-1',
      expectedVersion: 1,
      actorId: 'employee-1',
      canConfirmAny: false,
      canApprovePriceException: false,
      priceExceptions: [],
    });
    expect(confirmations.command).toMatchObject({
      operationId: 'operation-1',
      effectiveAt: new Date('2026-09-15T21:00:00.000Z'),
    });
  });
});
