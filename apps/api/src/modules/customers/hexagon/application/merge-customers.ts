import { normalizeCustomerIdentity } from '../domain/customer';
import type { CustomerClock, CustomerIdGenerator } from './customer.dependencies';
import type { CustomerMergeBook, CustomerMergeResult } from './customer-merge-book';

export interface MergeCustomersCommand {
  operationId: string;
  primaryCustomerId: string;
  duplicateCustomerId: string;
  expectedPrimaryVersion: number;
  expectedDuplicateVersion: number;
  resolvedName: string;
  resolvedPhone: string;
  resolvedDni?: string | null;
  resolvedAddress?: string | null;
  actorId: string;
}

export class MergeCustomers {
  constructor(
    private readonly book: CustomerMergeBook,
    private readonly ids: CustomerIdGenerator,
    private readonly clock: CustomerClock,
  ) {}

  merge(command: MergeCustomersCommand): Promise<CustomerMergeResult> {
    if (command.primaryCustomerId === command.duplicateCustomerId) {
      return Promise.resolve({ ok: false, reason: 'same-customer' });
    }
    if (
      !Number.isSafeInteger(command.expectedPrimaryVersion) ||
      command.expectedPrimaryVersion <= 0 ||
      !Number.isSafeInteger(command.expectedDuplicateVersion) ||
      command.expectedDuplicateVersion <= 0
    ) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    const identity = normalizeCustomerIdentity({
      name: command.resolvedName,
      phone: command.resolvedPhone,
      ...(command.resolvedDni === undefined ? {} : { dni: command.resolvedDni }),
      ...(command.resolvedAddress === undefined ? {} : { address: command.resolvedAddress }),
    });
    return this.book.merge({
      mergeId: this.ids.generate(),
      operationId: command.operationId,
      primaryCustomerId: command.primaryCustomerId,
      duplicateCustomerId: command.duplicateCustomerId,
      expectedPrimaryVersion: command.expectedPrimaryVersion,
      expectedDuplicateVersion: command.expectedDuplicateVersion,
      identity,
      actorId: command.actorId,
      effectiveAt: this.clock.now(),
    });
  }
}
