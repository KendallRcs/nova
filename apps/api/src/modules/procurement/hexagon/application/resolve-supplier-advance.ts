import type { ProcurementClock, ProcurementIdGenerator } from './procurement.dependencies';
import type {
  AdvanceResolutionResult,
  SupplierAdvanceResolutionBook,
} from './supplier-advance-resolution-book';
import {
  InvalidAdvanceAmountError,
  type ProcurementPaymentMethod,
} from '../domain/supplier-advance';

export class InvalidAdvanceLossReasonError extends Error {
  constructor() {
    super('La razón de la pérdida es obligatoria.');
    this.name = 'InvalidAdvanceLossReasonError';
  }
}

export class InvalidAdvanceVersionError extends Error {
  constructor() {
    super('La versión esperada del anticipo debe ser positiva.');
    this.name = 'InvalidAdvanceVersionError';
  }
}

export class ResolveSupplierAdvance {
  constructor(
    private readonly book: SupplierAdvanceResolutionBook,
    private readonly ids: ProcurementIdGenerator,
    private readonly clock: ProcurementClock,
  ) {}

  refund(command: {
    operationId: string;
    advanceId: string;
    expectedVersion: number;
    amountCents: number;
    method: ProcurementPaymentMethod;
    actorId: string;
  }): Promise<AdvanceResolutionResult> {
    validate(command.amountCents, command.expectedVersion);
    return this.book.resolve({
      ...command,
      kind: 'refund',
      resolutionId: this.ids.generate(),
      cashMovementId: this.ids.generate(),
      effectiveAt: this.clock.now(),
    });
  }

  loss(command: {
    operationId: string;
    advanceId: string;
    expectedVersion: number;
    amountCents: number;
    reason: string;
    actorId: string;
  }): Promise<AdvanceResolutionResult> {
    validate(command.amountCents, command.expectedVersion);
    const reason = command.reason.trim().replace(/\s+/g, ' ');
    if (reason.length === 0) throw new InvalidAdvanceLossReasonError();
    return this.book.resolve({
      ...command,
      reason,
      kind: 'loss',
      resolutionId: this.ids.generate(),
      effectiveAt: this.clock.now(),
    });
  }
}

function validate(amountCents: number, expectedVersion: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new InvalidAdvanceAmountError();
  }
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
    throw new InvalidAdvanceVersionError();
  }
}
