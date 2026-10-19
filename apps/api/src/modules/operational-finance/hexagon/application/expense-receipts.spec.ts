import { describe, expect, it } from 'vitest';

import type { FinanceClock, FinanceIdGenerator } from './finance.dependencies';
import {
  AttachExpenseReceipt,
  GetExpenseReceiptAccess,
  RemoveExpenseReceipt,
  type ExpenseReceiptBook,
  type ExpenseReceiptStorage,
  type StoredExpenseReceipt,
} from './expense-receipts';

const now = new Date('2026-10-19T20:00:00.000Z');
const expenseId = '0199ef04-1b00-7000-8000-000000000301';
const assetId = '0199ef04-1b00-7000-8000-000000000302';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

class FakeReceiptStorage implements ExpenseReceiptStorage {
  readonly stored: string[] = [];
  readonly removed: string[] = [];

  store(): Promise<StoredExpenseReceipt> {
    this.stored.push('nova/expense-receipts/new');
    return Promise.resolve({
      storageKey: 'nova/expense-receipts/new',
      mediaType: 'image/webp',
      bytes: 12_000,
    });
  }

  remove(storageKey: string): Promise<boolean> {
    this.removed.push(storageKey);
    return Promise.resolve(true);
  }

  temporaryAccess(storageKey: string, expiresAt: Date): string {
    return `https://files.example/${storageKey}?expires=${expiresAt.toISOString()}`;
  }
}

class FakeReceiptBook implements ExpenseReceiptBook {
  exists = true;
  hasReceipt = true;
  previousStorageKey: string | null = null;
  failReplace = false;

  expenseExists(): Promise<boolean> {
    return Promise.resolve(this.exists);
  }

  replace(): ReturnType<ExpenseReceiptBook['replace']> {
    if (this.failReplace) return Promise.reject(new Error('database unavailable'));
    return Promise.resolve(
      this.exists
        ? ({ ok: true, previousStorageKey: this.previousStorageKey } as const)
        : ({ ok: false, reason: 'expense-not-found' } as const),
    );
  }

  remove(): ReturnType<ExpenseReceiptBook['remove']> {
    if (!this.exists) return Promise.resolve({ ok: false, reason: 'expense-not-found' });
    return Promise.resolve(
      this.hasReceipt
        ? ({ ok: true, removedStorageKey: 'nova/expense-receipts/old' } as const)
        : ({ ok: false, reason: 'receipt-not-found' } as const),
    );
  }

  findStorageKey(): ReturnType<ExpenseReceiptBook['findStorageKey']> {
    if (!this.exists) return Promise.resolve({ ok: false, reason: 'expense-not-found' });
    return Promise.resolve(
      this.hasReceipt
        ? ({ ok: true, storageKey: 'nova/expense-receipts/old' } as const)
        : ({ ok: false, reason: 'receipt-not-found' } as const),
    );
  }
}

const ids: FinanceIdGenerator = { generate: () => assetId };
const clock: FinanceClock = { now: () => now };

describe('expense receipt management', () => {
  it('stores a valid optional receipt', async () => {
    const storage = new FakeReceiptStorage();
    const action = new AttachExpenseReceipt(new FakeReceiptBook(), storage, ids, clock);

    await expect(action.execute({ expenseId, content: jpeg })).resolves.toEqual({
      ok: true,
      receipt: {
        storageKey: 'nova/expense-receipts/new',
        mediaType: 'image/webp',
        bytes: 12_000,
      },
    });
  });

  it('rejects forged content before calling storage', async () => {
    const storage = new FakeReceiptStorage();
    const action = new AttachExpenseReceipt(new FakeReceiptBook(), storage, ids, clock);
    await expect(
      action.execute({ expenseId, content: new TextEncoder().encode('fake') }),
    ).resolves.toEqual({ ok: false, reason: 'unsupported-receipt-format' });
    expect(storage.stored).toEqual([]);
  });

  it('compensates a new upload when database persistence fails', async () => {
    const storage = new FakeReceiptStorage();
    const book = new FakeReceiptBook();
    book.failReplace = true;
    const action = new AttachExpenseReceipt(book, storage, ids, clock);
    await expect(action.execute({ expenseId, content: jpeg })).rejects.toThrow(
      'database unavailable',
    );
    expect(storage.removed).toEqual(['nova/expense-receipts/new']);
  });

  it('cleans the old resource only after replacing its association', async () => {
    const storage = new FakeReceiptStorage();
    const book = new FakeReceiptBook();
    book.previousStorageKey = 'nova/expense-receipts/old';
    await new AttachExpenseReceipt(book, storage, ids, clock).execute({ expenseId, content: jpeg });
    expect(storage.removed).toEqual(['nova/expense-receipts/old']);
  });

  it('removes the association and then cleans external storage', async () => {
    const storage = new FakeReceiptStorage();
    await expect(
      new RemoveExpenseReceipt(new FakeReceiptBook(), storage, clock).execute(expenseId),
    ).resolves.toEqual({ ok: true, removedStorageKey: 'nova/expense-receipts/old' });
    expect(storage.removed).toEqual(['nova/expense-receipts/old']);
  });

  it('grants access through a five-minute temporary URL', async () => {
    const storage = new FakeReceiptStorage();
    const result = await new GetExpenseReceiptAccess(new FakeReceiptBook(), storage, clock).execute(
      expenseId,
    );
    expect(result).toEqual({
      ok: true,
      url: 'https://files.example/nova/expense-receipts/old?expires=2026-10-19T20:05:00.000Z',
      expiresAt: new Date('2026-10-19T20:05:00.000Z'),
    });
  });
});
