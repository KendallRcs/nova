import { describe, expect, it } from 'vitest';

import type {
  CustomerMergeBook,
  CustomerMergeResult,
  PreparedCustomerMerge,
} from './customer-merge-book';
import { MergeCustomers } from './merge-customers';

class RecordingMergeBook implements CustomerMergeBook {
  commands: PreparedCustomerMerge[] = [];
  merge(command: PreparedCustomerMerge): Promise<CustomerMergeResult> {
    this.commands.push(command);
    return Promise.resolve({ ok: false, reason: 'customer-not-found' });
  }
}

describe('MergeCustomers', () => {
  it('normalizes resolved identity and prepares an auditable merge', async () => {
    const book = new RecordingMergeBook();
    await new MergeCustomers(
      book,
      { generate: () => 'merge-1' },
      { now: () => new Date('2026-09-15T19:00:00.000Z') },
    ).merge({
      operationId: 'operation-1',
      primaryCustomerId: 'customer-1',
      duplicateCustomerId: 'customer-2',
      expectedPrimaryVersion: 1,
      expectedDuplicateVersion: 2,
      resolvedName: ' Ana  Torres ',
      resolvedPhone: '987-654-321',
      resolvedDni: null,
      actorId: 'admin-1',
    });
    expect(book.commands).toHaveLength(1);
    expect(book.commands[0]?.mergeId).toBe('merge-1');
    expect(book.commands[0]?.identity.name).toBe('Ana Torres');
    expect(book.commands[0]?.identity.phoneNormalized).toBe('+51987654321');
    expect(book.commands[0]?.effectiveAt).toEqual(new Date('2026-09-15T19:00:00.000Z'));
  });

  it('rejects the same primary and duplicate before persistence', async () => {
    const book = new RecordingMergeBook();
    await expect(
      new MergeCustomers(book, { generate: () => 'merge-1' }, { now: () => new Date() }).merge({
        operationId: 'operation-1',
        primaryCustomerId: 'customer-1',
        duplicateCustomerId: 'customer-1',
        expectedPrimaryVersion: 1,
        expectedDuplicateVersion: 1,
        resolvedName: 'Ana',
        resolvedPhone: '987654321',
        actorId: 'admin-1',
      }),
    ).resolves.toEqual({ ok: false, reason: 'same-customer' });
    expect(book.commands).toEqual([]);
  });
});
